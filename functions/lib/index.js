"use strict";
// functions/src/index.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAuthUserDeleted = exports.onAuthUserCreated = exports.advanceOnComplete = exports.notifyOnMatchComplete = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const v1_1 = require("firebase-functions/v1"); // <-- v1 auth triggers live here in v6
const nodemailer = __importStar(require("nodemailer"));
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
// Deploy to your closest Google Cloud region:
const region = 'africa-south1';
// ---- Secrets (set via: firebase functions:secrets:set MAIL_USER / MAIL_PASS) ----
const MAIL_USER = (0, params_1.defineSecret)('MAIL_USER'); // your Gmail address
const MAIL_PASS = (0, params_1.defineSecret)('MAIL_PASS'); // 16-char Gmail App Password
function winnerOf(after) {
    const hs = after.homeScore ?? 0;
    const as = after.awayScore ?? 0;
    if (hs > as)
        return 'home';
    if (as > hs)
        return 'away';
    if (after.decision === 'home' || after.decision === 'homeET' || after.decision === 'homePens')
        return 'home';
    if (after.decision === 'away' || after.decision === 'awayET' || after.decision === 'awayPens')
        return 'away';
    return Math.random() < 0.5 ? 'home' : 'away';
}
function nextSlotFor(stage, pair) {
    if (stage === 'QF') {
        if (pair === 1)
            return { nextStage: 'SF', nextPair: 1, nextSlot: 'home' };
        if (pair === 2)
            return { nextStage: 'SF', nextPair: 1, nextSlot: 'away' };
        if (pair === 3)
            return { nextStage: 'SF', nextPair: 2, nextSlot: 'home' };
        if (pair === 4)
            return { nextStage: 'SF', nextPair: 2, nextSlot: 'away' };
    }
    if (stage === 'SF') {
        if (pair === 1)
            return { nextStage: 'F', nextPair: 1, nextSlot: 'home' };
        if (pair === 2)
            return { nextStage: 'F', nextPair: 1, nextSlot: 'away' };
    }
    return { nextStage: null };
}
// ---------- Function 1: Email on match completion ----------
exports.notifyOnMatchComplete = (0, firestore_2.onDocumentWritten)({
    document: 'matches/{matchId}',
    region,
    secrets: [MAIL_USER, MAIL_PASS],
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    // Only proceed when status changed to 'completed'
    if (!after || after.status !== 'completed' || (before && before.status === 'completed'))
        return;
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
        const body = `${after.homeTeamId} ${after.homeScore} : ${after.awayScore} ${after.awayTeamId}\n\n` +
            `Mode: ${after.mode}\n`;
        await transporter.sendMail({ from: user, to, subject, text: body });
        console.log(`Mail sent to: ${to}`);
    }
    catch (e) {
        console.error('notifyOnMatchComplete failed:', e?.message || e);
    }
});
// ---------- Function 2: Auto-advance winners ----------
exports.advanceOnComplete = (0, firestore_2.onDocumentWritten)({ document: 'matches/{matchId}', region }, async (event) => {
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
    // Only act when a match transitions -> completed
    if (!after || after.status !== 'completed') {
        console.log('[advanceOnComplete] skip: after missing or not completed');
        return;
    }
    if (before && before.status === 'completed') {
        console.log('[advanceOnComplete] skip: already completed previously');
        return;
    }
    const tournamentId = after.tournamentId ?? null;
    const stage = after.stage;
    const pair = Number(after.pair);
    const who = (() => {
        const hs = after.homeScore ?? 0, as = after.awayScore ?? 0;
        if (hs > as)
            return 'home';
        if (as > hs)
            return 'away';
        if (['home', 'homeET', 'homePens'].includes(after.decision))
            return 'home';
        if (['away', 'awayET', 'awayPens'].includes(after.decision))
            return 'away';
        return Math.random() < 0.5 ? 'home' : 'away';
    })();
    const winnerTeamId = who === 'home' ? after.homeTeamId : after.awayTeamId;
    // Compute destination (SF/F + slot)
    const next = (() => {
        if (stage === 'QF') {
            if (pair === 1)
                return { nextStage: 'SF', nextPair: 1, nextSlot: 'home' };
            if (pair === 2)
                return { nextStage: 'SF', nextPair: 1, nextSlot: 'away' };
            if (pair === 3)
                return { nextStage: 'SF', nextPair: 2, nextSlot: 'home' };
            if (pair === 4)
                return { nextStage: 'SF', nextPair: 2, nextSlot: 'away' };
        }
        if (stage === 'SF') {
            if (pair === 1)
                return { nextStage: 'F', nextPair: 1, nextSlot: 'home' };
            if (pair === 2)
                return { nextStage: 'F', nextPair: 1, nextSlot: 'away' };
        }
        return { nextStage: null };
    })();
    const { nextStage, nextPair, nextSlot } = next;
    if (!nextStage || !nextPair || !nextSlot) {
        console.log('[advanceOnComplete] no next stage/slot for this match');
        return;
    }
    // Query for the next match *within the same tournament (if present)*
    let qRef = db.collection('matches')
        .where('stage', '==', nextStage)
        .where('pair', '==', nextPair);
    if (tournamentId) {
        qRef = qRef.where('tournamentId', '==', tournamentId);
    }
    const q = await qRef.limit(1).get();
    const now = Date.now();
    if (q.empty) {
        // Create the next match shell in the same tournament
        const payload = {
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
        if (tournamentId)
            payload.tournamentId = tournamentId;
        if (nextSlot === 'home') {
            payload.homeTeamId = winnerTeamId;
            payload.awayTeamId = '__TBD__';
        }
        else {
            payload.homeTeamId = '__TBD__';
            payload.awayTeamId = winnerTeamId;
        }
        const docRef = await db.collection('matches').add(payload);
        console.log(`[advanceOnComplete] created ${nextStage}-${nextPair} (${nextSlot}=${winnerTeamId}) id=${docRef.id}`);
    }
    else {
        // Patch the existing next match
        const doc = q.docs[0];
        const patch = { updatedAt: now };
        if (nextSlot === 'home')
            patch.homeTeamId = winnerTeamId;
        else
            patch.awayTeamId = winnerTeamId;
        if (tournamentId)
            patch.tournamentId = tournamentId; // keep it consistent if missing
        await doc.ref.update(patch);
        console.log(`[advanceOnComplete] updated ${nextStage}-${nextPair} (${nextSlot}=${winnerTeamId}) id=${doc.id}`);
    }
});
// ---------- Identity mirroring (v1 triggers on v6) ----------
exports.onAuthUserCreated = v1_1.auth.user().onCreate(async (user) => {
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
exports.onAuthUserDeleted = v1_1.auth.user().onDelete(async (user) => {
    const { uid } = user;
    await Promise.allSettled([
        db.doc(`userProfiles/${uid}`).delete(),
        db.doc(`userRoles/${uid}`).delete(),
        db.doc(`admins/${uid}`).delete(),
    ]);
});
