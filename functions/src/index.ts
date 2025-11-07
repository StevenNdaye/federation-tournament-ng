import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {defineSecret} from 'firebase-functions/params';
import {auth as authV1} from 'firebase-functions/v1';
import * as nodemailer from 'nodemailer';

initializeApp();
const db = getFirestore();

const region = 'africa-south1';

const MAIL_USER = defineSecret('MAIL_USER');
const MAIL_PASS = defineSecret('MAIL_PASS');

type Stage = 'QF' | 'SF' | 'F';

function winnerOf(after: any): 'home' | 'away' {
  const hs = after.homeScore ?? 0;
  const as = after.awayScore ?? 0;
  if (hs > as) return 'home';
  if (as > hs) return 'away';
  if (after.decision === 'home' || after.decision === 'homeET' || after.decision === 'homePens') return 'home';
  if (after.decision === 'away' || after.decision === 'awayET' || after.decision === 'awayPens') return 'away';
  return Math.random() < 0.5 ? 'home' : 'away';
}

function nextSlotFor(stage: Stage, pair: number) {
  if (stage === 'QF') {
    if (pair === 1) return {nextStage: 'SF' as Stage, nextPair: 1, nextSlot: 'home' as const};
    if (pair === 2) return {nextStage: 'SF' as Stage, nextPair: 1, nextSlot: 'away' as const};
    if (pair === 3) return {nextStage: 'SF' as Stage, nextPair: 2, nextSlot: 'home' as const};
    if (pair === 4) return {nextStage: 'SF' as Stage, nextPair: 2, nextSlot: 'away' as const};
  }
  if (stage === 'SF') {
    if (pair === 1) return {nextStage: 'F' as Stage, nextPair: 1, nextSlot: 'home' as const};
    if (pair === 2) return {nextStage: 'F' as Stage, nextPair: 1, nextSlot: 'away' as const};
  }
  return {nextStage: null as null};
}

export const notifyOnMatchComplete = onDocumentWritten(
  {
    document: 'matches/{matchId}',
    region,
    secrets: [MAIL_USER, MAIL_PASS],
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!after || after.status !== 'completed' || (before && before.status === 'completed')) return;

    const user = MAIL_USER.value();
    const pass = MAIL_PASS.value();
    if (!user || !pass) {
      console.warn('MAIL_USER or MAIL_PASS not set; skipping email notification.');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {user, pass},
    });

    try {
      const [homeSnap, awaySnap] = await Promise.all([
        db.doc(`federations/${after.homeTeamId}`).get(),
        db.doc(`federations/${after.awayTeamId}`).get(),
      ]);

      const to = [
        homeSnap.data()?.representativeEmail,
        awaySnap.data()?.representativeEmail,
      ].filter(Boolean).join(',');

      if (!to) {
        console.log('No recipient email found; skipping send.');
        return;
      }

      const subject = `Match Result: ${after.homeScore} - ${after.awayScore}`;
      const body =
        `${after.homeTeamId} ${after.homeScore} : ${after.awayScore} ${after.awayTeamId}\n\n` +
        `Mode: ${after.mode}\n`;

      await transporter.sendMail({from: user, to, subject, text: body});
      console.log(`Mail sent to: ${to}`);
    } catch (e: any) {
      console.error('notifyOnMatchComplete failed:', e?.message || e);
    }
  }
);

export const advanceOnComplete = onDocumentWritten(
  {document: 'matches/{matchId}', region},
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    console.log('[advanceOnComplete] fired', {
      id: event.params?.matchId,
      beforeStatus: before?.status,
      afterStatus: after?.status,
      stage: after?.stage,
      pair: after?.pair,
      tournamentId: after?.tournamentId ?? null,
    });

    if (!after || after.status !== 'completed') {
      console.log('[advanceOnComplete] skip: after missing or not completed');
      return;
    }
    if (before && before.status === 'completed') {
      console.log('[advanceOnComplete] skip: already completed previously');
      return;
    }

    const tournamentId: string | null = after.tournamentId ?? null;
    const stage = after.stage as 'QF' | 'SF' | 'F';
    const pair = Number(after.pair);
    const who: 'home' | 'away' = (() => {
      const hs = after.homeScore ?? 0, as = after.awayScore ?? 0;
      if (hs > as) return 'home';
      if (as > hs) return 'away';
      if (['home', 'homeET', 'homePens'].includes(after.decision)) return 'home';
      if (['away', 'awayET', 'awayPens'].includes(after.decision)) return 'away';
      return Math.random() < 0.5 ? 'home' : 'away';
    })();

    const winnerTeamId = who === 'home' ? after.homeTeamId : after.awayTeamId;

    const next = ((): { nextStage: 'SF' | 'F' | null; nextPair?: number; nextSlot?: 'home' | 'away' } => {
      if (stage === 'QF') {
        if (pair === 1) return {nextStage: 'SF', nextPair: 1, nextSlot: 'home'};
        if (pair === 2) return {nextStage: 'SF', nextPair: 1, nextSlot: 'away'};
        if (pair === 3) return {nextStage: 'SF', nextPair: 2, nextSlot: 'home'};
        if (pair === 4) return {nextStage: 'SF', nextPair: 2, nextSlot: 'away'};
      }
      if (stage === 'SF') {
        if (pair === 1) return {nextStage: 'F', nextPair: 1, nextSlot: 'home'};
        if (pair === 2) return {nextStage: 'F', nextPair: 1, nextSlot: 'away'};
      }
      return {nextStage: null};
    })();

    const {nextStage, nextPair, nextSlot} = next;
    if (!nextStage || !nextPair || !nextSlot) {
      console.log('[advanceOnComplete] no next stage/slot for this match');
      return;
    }

    let qRef = db.collection('matches')
      .where('stage', '==', nextStage)
      .where('pair', '==', nextPair as number);

    if (tournamentId) {
      qRef = qRef.where('tournamentId', '==', tournamentId);
    }

    const q = await qRef.limit(1).get();
    const now = Date.now();

    if (q.empty) {
      const payload: any = {
        stage: nextStage,
        pair: nextPair,
        status: 'scheduled',
        mode: 'simulate',
        homeScore: 0,
        awayScore: 0,
        goals: [],
        createdAt: now,
        updatedAt: now,
      };
      if (tournamentId) payload.tournamentId = tournamentId;
      if (nextSlot === 'home') {
        payload.homeTeamId = winnerTeamId;
        payload.awayTeamId = '__TBD__';
      } else {
        payload.homeTeamId = '__TBD__';
        payload.awayTeamId = winnerTeamId;
      }

      const docRef = await db.collection('matches').add(payload);
      console.log(`[advanceOnComplete] created ${nextStage}-${nextPair} (${nextSlot}=${winnerTeamId}) id=${docRef.id}`);
    } else {
      // Patch the existing next match
      const doc = q.docs[0];
      const patch: any = {updatedAt: now};
      if (nextSlot === 'home') patch.homeTeamId = winnerTeamId; else patch.awayTeamId = winnerTeamId;
      if (tournamentId) patch.tournamentId = tournamentId; // keep it consistent if missing
      await doc.ref.update(patch);
      console.log(`[advanceOnComplete] updated ${nextStage}-${nextPair} (${nextSlot}=${winnerTeamId}) id=${doc.id}`);
    }
  }
);

export const onAuthUserCreated = authV1.user().onCreate(async (user) => {
  const {uid, email, displayName, photoURL, providerData} = user;
  await db.doc(`userProfiles/${uid}`).set({
    uid,
    email: email || null,
    displayName: displayName || null,
    photoURL: photoURL || null,
    providers: (providerData || []).map(p => p.providerId),
    createdAt: Date.now(),
  }, {merge: true});

  const roleRef = db.doc(`userRoles/${uid}`);
  if (!(await roleRef.get()).exists) {
    await roleRef.set({role: 'representative', createdAt: Date.now()});
  }
});

export const onAuthUserDeleted = authV1.user().onDelete(async (user) => {
  const {uid} = user;
  await Promise.allSettled([
    db.doc(`userProfiles/${uid}`).delete(),
    db.doc(`userRoles/${uid}`).delete(),
    db.doc(`admins/${uid}`).delete(),
  ]);
});
