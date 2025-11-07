// functions/src/index.ts

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { auth as authV1 } from 'firebase-functions/v1'; // <-- v1 auth triggers live here in v6
import * as nodemailer from 'nodemailer';

initializeApp();
const db = getFirestore();

// Deploy to your closest Google Cloud region:
const region = 'africa-south1';

// ---- Secrets (set via: firebase functions:secrets:set MAIL_USER / MAIL_PASS) ----
const MAIL_USER = defineSecret('MAIL_USER'); // your Gmail address
const MAIL_PASS = defineSecret('MAIL_PASS'); // 16-char Gmail App Password

// ---------- Types & helpers ----------
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
    if (pair === 1) return { nextStage: 'SF' as Stage, nextPair: 1, nextSlot: 'home' as const };
    if (pair === 2) return { nextStage: 'SF' as Stage, nextPair: 1, nextSlot: 'away' as const };
    if (pair === 3) return { nextStage: 'SF' as Stage, nextPair: 2, nextSlot: 'home' as const };
    if (pair === 4) return { nextStage: 'SF' as Stage, nextPair: 2, nextSlot: 'away' as const };
  }
  if (stage === 'SF') {
    if (pair === 1) return { nextStage: 'F' as Stage, nextPair: 1, nextSlot: 'home' as const };
    if (pair === 2) return { nextStage: 'F' as Stage, nextPair: 1, nextSlot: 'away' as const };
  }
  return { nextStage: null as null };
}

// ---------- Function 1: Email on match completion ----------
export const notifyOnMatchComplete = onDocumentWritten(
  {
    document: 'matches/{matchId}',
    region,
    secrets: [MAIL_USER, MAIL_PASS],
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    // Only proceed when status changed to 'completed'
    if (!after || after.status !== 'completed' || (before && before.status === 'completed')) return;

    const user = MAIL_USER.value();
    const pass = MAIL_PASS.value();
    if (!user || !pass) {
      console.warn('MAIL_USER or MAIL_PASS not set; skipping email notification.');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
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

      await transporter.sendMail({ from: user, to, subject, text: body });
      console.log(`Mail sent to: ${to}`);
    } catch (e: any) {
      console.error('notifyOnMatchComplete failed:', e?.message || e);
    }
  }
);

// ---------- Function 2: Auto-advance winners ----------
export const advanceOnComplete = onDocumentWritten(
  { document: 'matches/{matchId}', region },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!after || after.status !== 'completed' || (before && before.status === 'completed')) return;

    const stage: Stage = after.stage as Stage;
    const pair: number = after.pair;
    const who = winnerOf(after);
    const winnerTeamId = who === 'home' ? after.homeTeamId : after.awayTeamId;

    const { nextStage, nextPair, nextSlot } = nextSlotFor(stage, pair);
    if (!nextStage || !nextPair || !nextSlot) return;

    const q = await db
      .collection('matches')
      .where('stage', '==', nextStage)
      .where('pair', '==', nextPair)
      .limit(1)
      .get();

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
      if (nextSlot === 'home') payload.homeTeamId = winnerTeamId, payload.awayTeamId = '__TBD__';
      else payload.homeTeamId = '__TBD__', payload.awayTeamId = winnerTeamId;

      await db.collection('matches').add(payload);
      console.log(`Created next match ${nextStage}-${nextPair} with ${nextSlot}=${winnerTeamId}`);
    } else {
      const doc = q.docs[0];
      const patch: any = { updatedAt: now };
      if (nextSlot === 'home') patch.homeTeamId = winnerTeamId; else patch.awayTeamId = winnerTeamId;
      await doc.ref.update(patch);
      console.log(`Updated next match ${nextStage}-${nextPair} set ${nextSlot}=${winnerTeamId}`);
    }
  }
);

// ---------- Identity mirroring (v1 triggers on v6) ----------
export const onAuthUserCreated = authV1.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL, providerData } = user;
  await db.doc(`userProfiles/${uid}`).set({
    uid,
    email: email || null,
    displayName: displayName || null,
    photoURL: photoURL || null,
    providers: (providerData || []).map(p => p.providerId),
    createdAt: Date.now(),
  }, { merge: true });

  const roleRef = db.doc(`userRoles/${uid}`);
  if (!(await roleRef.get()).exists) {
    await roleRef.set({ role: 'representative', createdAt: Date.now() });
  }
});

export const onAuthUserDeleted = authV1.user().onDelete(async (user) => {
  const { uid } = user;
  await Promise.allSettled([
    db.doc(`userProfiles/${uid}`).delete(),
    db.doc(`userRoles/${uid}`).delete(),
    db.doc(`admins/${uid}`).delete(),
  ]);
});
