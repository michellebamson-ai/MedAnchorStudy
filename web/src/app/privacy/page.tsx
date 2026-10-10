import { Shell } from "@/components/shell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { describeProvider } from "@/lib/ai/provider";
import { storageStatus } from "@/lib/storage";
import { mailerStatus } from "@/lib/mailer";
import { isBypassOn } from "@/lib/bypass";

export const metadata = { title: "Privacy" };
export const dynamic = "force-dynamic";

/**
 * Privacy (PROGRESS_SPEC §12, PRD §4.2).
 *
 * Generated from live configuration rather than written as static prose, so it
 * cannot drift into claiming something the deployment is not actually doing —
 * which is the normal way a privacy page becomes a lie.
 */
export default async function PrivacyPage() {
  const user = await getCurrentUser().catch(() => null);
  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });
  const searchTopics = topics.map((t) => ({ slug: t.slug, title: t.title }));

  const providers = describeProvider();
  const storage = storageStatus();
  const mail = mailerStatus();

  return (
    <Shell section="" name={user?.name ?? "Guest"} topics={searchTopics}>
      <div className="page-head">
        <span className="eyebrow">Plain words, not legal boilerplate</span>
        <h1 className="display">Privacy</h1>
        <p className="lede">What we store, where it goes, and how to take it back.</p>
      </div>

      <div className="legal">
        <div className="alert alert-warn">
          <b>Do not upload real patient records.</b> MedAnchor Study is an education tool. It is not
          HIPAA-covered, has no clinical audit trail, and is not a medical device. Lecture notes,
          slides, textbooks and question banks are what it is for.
        </div>

        <h2>What we store</h2>
        <ul>
          <li>
            <b>Your account</b> — email, and the name, school and year you entered.
          </li>
          <li>
            <b>Your material</b> — uploaded files and pasted text, readable only by you.
          </li>
          <li>
            <b>Your learning record</b> — every session, question, case and review you complete, plus
            the topic statuses derived from them. This is what makes Progress and the Study Plan
            personalised rather than generic.
          </li>
          <li>
            <b>Your study plan</b> — exams, deadlines, available hours, and the tasks scheduled from
            them.
          </li>
        </ul>
        <p className="fineprint-note">
          Uploaded files are private to your account. Only you can read them, and that is enforced on
          the server rather than in the interface.
        </p>

        <h2>What leaves this server</h2>
        <p>
          Generated content — tutor turns, summaries, flashcards and questions — is produced by a
          third-party AI provider. Currently serving:{" "}
          <b>{providers.join(" + ")}</b>
          {providers.every((p) => p === "simulated")
            ? " — none of it is currently sent anywhere; the app is using its built-in offline engine."
            : "."}
        </p>
        <p>
          That means your questions and the text of your uploaded material are transmitted to that
          provider to generate an answer. Groq states it does not use customer data for training.
          Google&apos;s free tier states submitted content may be used to improve their products — which is
          one reason we do not treat the free tier as the production choice.
        </p>
        <p className="fineprint-note">
          We do not send real patient data to anyone. That is the line this app is built around.
        </p>

        <h2>How your files are stored</h2>
        <p>
          {storage.configured
            ? `Uploads are held in object storage (bucket ${storage.bucket}), so they survive a redeploy.`
            : "Uploads are currently held on this server's local disk. That is fine while testing, but they would be lost on a redeploy — this deployment has no object storage configured."}
        </p>

        <h2>Email</h2>
        <p>
          {mail.configured
            ? `Password reset and address confirmation are sent from ${mail.from}. We store your address only to send them.`
            : "Email sending is not configured on this deployment, so password reset and address confirmation cannot be delivered."}
        </p>

        <h2>What we don&apos;t do</h2>
        <ul>
          <li>No advertising or third-party marketing trackers.</li>
          <li>No selling or sharing your data.</li>
          <li>
            No behavioural analytics. We do not track you across other sites, because there are no
            such trackers here at all.
          </li>
        </ul>

        <h2>Your rights</h2>
        <ul>
          <li>
            <b>Download everything</b> — Settings has a button that exports every row we hold about
            you as JSON.
          </li>
          <li>
            <b>Delete everything</b> — the same page deletes your account, uploads, history and plan
            permanently. There is no soft-delete and no backup.
          </li>
        </ul>

        <h2>Deletion and recovery</h2>
        <p>
          Deleting your account removes it and its uploaded files immediately. It cannot be undone,
          which is why the delete button asks you to type your email first. Export your data before
          you delete it if you want a copy.
        </p>

        {isBypassOn() ? (
          <div className="alert alert-warn">
            This deployment is running with sign-in bypassed for testing. Every visitor is the same
            shared account, so nothing described above is per-person here.
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
