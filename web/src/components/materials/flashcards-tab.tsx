import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dueCards } from "@/lib/spaced-repetition";
import { ReviewRunner, type ReviewCard } from "@/components/materials/review-runner";
import { CardForm, CardRow } from "@/components/materials/card-manage";

/**
 * Flashcards tab (MATERIALS_SPEC.md §5). One deck per material, plus the
 * starter deck; Wrong/Correct grading with SM-2 scheduling behind it.
 */
export async function FlashcardsTab({
  userId,
  q,
  deck,
  review,
}: {
  userId: string | null;
  q: string;
  deck?: string;
  review?: string;
}) {
  const term = q.trim().toLowerCase();
  const matchQ = (front: string, back: string) =>
    term ? front.toLowerCase().includes(term) || back.toLowerCase().includes(term) : true;

  // Starter deck: shared seed content, visible to everyone.
  const seedCards = (
    await prisma.flashcard.findMany({
      where: { origin: "seed" },
      include: { topic: { select: { slug: true, title: true } } },
      orderBy: { createdAt: "asc" },
    })
  ).filter((c) => matchQ(c.front, c.back));

  if (!userId) {
    return (
      <div className="stack-lg">
        <DeckHead
          title="Flashcards"
          subtitle="Sign in to track reviews — until then, the starter deck is yours to flip through."
          signedIn={false}
        />
        <DeckList
          title="Starter deck"
          subtitle={`${seedCards.length} cards · shared essentials`}
          cards={seedCards}
          href="/materials?tab=flashcards&deck=seed"
        />
        {deck === "seed" ? (
          <ReviewRunner
            title="Starter deck"
            cards={seedCards.map(toReviewCard)}
            signedIn={false}
            backHref="/materials?tab=flashcards"
          />
        ) : null}
      </div>
    );
  }

  const [states, mine, documents] = await Promise.all([
    prisma.cardReviewState.findMany({ where: { userId } }),
    prisma.flashcard.findMany({
      where: { document: { userId } },
      include: { topic: { select: { slug: true, title: true } }, document: { select: { id: true, title: true, subject: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.document.findMany({
      where: { userId },
      select: { id: true, title: true, subject: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const stateByCard = new Map(states.map((s) => [s.cardId, s]));
  const now = Date.now();
  const dueIds = new Set(states.filter((s) => s.dueAt.getTime() <= now).map((s) => s.cardId));
  const newIds = new Set(mine.filter((c) => !stateByCard.has(c.id)).map((c) => c.id));

  const decks = documents
    .map((d) => ({
      doc: d,
      cards: mine
        .filter((c) => c.documentId === d.id)
        .filter((c) => matchQ(c.front, c.back)),
    }))
    .filter((d) => d.cards.length > 0);

  // ---- Review mode ----
  if (review) {
    const pool: typeof mine =
      review === "due"
        ? mine.filter((c) => dueIds.has(c.id) || newIds.has(c.id))
        : review === "seed"
          ? (seedCards as unknown as typeof mine)
          : mine.filter((c) => c.documentId === review);
    if (!pool.length) {
      return (
        <div className="surface" style={{ maxWidth: 560, textAlign: "center" }}>
          <h2 className="display-lg">You’re done for today</h2>
          <p className="card-sub" style={{ marginTop: "var(--sp-2)" }}>
            Next review is tomorrow.
          </p>
          <div style={{ marginTop: "var(--sp-4)" }}>
            <Link className="btn btn-primary btn-sm" href="/materials?tab=flashcards">
              Back to decks
            </Link>
          </div>
        </div>
      );
    }
    const doc = documents.find((d) => d.id === review);
    return (
      <ReviewRunner
        title={review === "due" ? "Due today" : review === "seed" ? "Starter deck" : (doc?.title ?? "Deck")}
        cards={pool.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
          hint: c.hint,
          topicSlug: c.topic?.slug ?? null,
          topicTitle: c.topic?.title ?? null,
          cardType: c.cardType,
        }))}
        signedIn
        backHref="/materials?tab=flashcards"
      />
    );
  }

  // ---- Deck detail ----
  if (deck && deck !== "seed") {
    const d = documents.find((x) => x.id === deck);
    const cards = mine.filter((c) => c.documentId === deck).filter((c) => matchQ(c.front, c.back));
    if (!d) {
      return (
        <div className="alert alert-danger">
          Deck not found. <Link href="/materials?tab=flashcards">Back to decks</Link>
        </div>
      );
    }
    const deckDue = cards.filter((c) => dueIds.has(c.id) || newIds.has(c.id)).length;
    return (
      <div className="stack-lg" style={{ maxWidth: 760 }}>
        <Link className="btn btn-ghost btn-sm" href="/materials?tab=flashcards">
          ← All decks
        </Link>
        <div className="row-between">
          <div>
            <span className="eyebrow">{d.subject ?? "Deck"}</span>
            <h2 className="display-sm">{d.title}</h2>
            <p className="list-sub" style={{ marginTop: 4 }}>
              {cards.length} cards · {deckDue} due · {cards.length - deckDue} learned
            </p>
          </div>
          {deckDue > 0 ? (
            <Link className="btn btn-primary" href={`/materials?tab=flashcards&review=${d.id}`}>
              Start review
            </Link>
          ) : null}
        </div>
        <div className="stack-sm">
          {cards.map((c) => (
            <CardRow
              key={c.id}
              card={{ id: c.id, front: c.front, back: c.back, cardType: c.cardType, note: stateByCard.get(c.id)?.note ?? null }}
            />
          ))}
        </div>
        <CardForm documentId={d.id} />
      </div>
    );
  }

  const dueCount = dueIds.size + newIds.size;

  return (
    <div className="stack-lg">
      <DeckHead
        title="Flashcards"
        subtitle="Cards come back at the right time — wrong sooner, correct later."
        signedIn
      />

      <section className="surface">
        <div className="row-between" style={{ gap: "var(--sp-4)" }}>
          <div>
            <span className="eyebrow">Today</span>
            <h2 className="display-lg">Due today: {dueCount} card{dueCount === 1 ? "" : "s"}</h2>
          </div>
          {dueCount > 0 ? (
            <Link className="btn btn-primary" href="/materials?tab=flashcards&review=due">
              Start review
            </Link>
          ) : (
            <span className="hint">You’re done for today. Next review is tomorrow.</span>
          )}
        </div>
      </section>

      {decks.length === 0 && seedCards.length === 0 ? (
        <div className="surface" style={{ textAlign: "center" }}>
          <h3 className="display-lg">No flashcards yet</h3>
          <p className="card-sub" style={{ marginTop: "var(--sp-2)" }}>
            Flashcards show up here after you analyze a material.
          </p>
          <div style={{ marginTop: "var(--sp-4)" }}>
            <Link className="btn btn-primary btn-sm" href="/materials?tab=analyze">
              Go to Analyze Docs
            </Link>
          </div>
        </div>
      ) : (
        <section>
          <h2 className="display-lg" style={{ marginBottom: "var(--sp-4)" }}>
            Decks
          </h2>
          <div className="deck-grid">
            {decks.map(({ doc, cards }) => {
              const dd = cards.filter((c) => dueIds.has(c.id) || newIds.has(c.id)).length;
              const weak = cards.some((c) => c.topic?.slug);
              return (
                <Link key={doc.id} className="deck" href={`/materials?tab=flashcards&deck=${doc.id}`}>
                  <span className="list-title">{doc.title}</span>
                  <span className="list-sub">{doc.subject ?? "Deck"}</span>
                  <span className="deck-counts">
                    <span>{cards.length} cards</span>
                    <span>{dd} due</span>
                    <span>{cards.length - dd} learned</span>
                  </span>
                  {weak ? <span className="tag tag-review">Needs review</span> : null}
                </Link>
              );
            })}
            {seedCards.length > 0 ? (
              <Link className="deck" href="/materials?tab=flashcards&deck=seed">
                <span className="list-title">Starter deck</span>
                <span className="list-sub">Shared essentials</span>
                <span className="deck-counts">
                  <span>{seedCards.length} cards</span>
                </span>
              </Link>
            ) : null}
          </div>
        </section>
      )}

      {deck === "seed" ? (
        <ReviewRunner
          title="Starter deck"
          cards={seedCards.map(toReviewCard)}
          signedIn
          backHref="/materials?tab=flashcards"
        />
      ) : null}

      <CardForm />
    </div>
  );
}

function DeckHead({ title, subtitle, signedIn }: { title: string; subtitle: string; signedIn: boolean }) {
  return (
    <div className="row-between">
      <div>
        <h2 className="display-lg">{title}</h2>
        <p className="card-sub" style={{ marginTop: 4, marginBottom: 0 }}>
          {subtitle}
        </p>
      </div>
      {signedIn ? null : (
        <Link className="btn btn-primary btn-sm" href="/login">
          Sign in to track reviews
        </Link>
      )}
    </div>
  );
}

function DeckList({
  title,
  subtitle,
  cards,
  href,
}: {
  title: string;
  subtitle: string;
  cards: Array<{ id: string; front: string }>;
  href: string;
}) {
  return (
    <section>
      <div className="deck-grid">
        <Link className="deck" href={href}>
          <span className="list-title">{title}</span>
          <span className="list-sub">{subtitle}</span>
          <span className="deck-counts">
            <span>{cards.length} cards</span>
          </span>
        </Link>
      </div>
    </section>
  );
}

function toReviewCard(c: {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  topic: { slug: string; title: string } | null;
  cardType: string;
}): ReviewCard {
  return {
    id: c.id,
    front: c.front,
    back: c.back,
    hint: c.hint,
    topicSlug: c.topic?.slug ?? null,
    topicTitle: c.topic?.title ?? null,
    cardType: c.cardType,
  };
}
