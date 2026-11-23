import Link from "next/link";

const verifier = [
  ["Claim supported", 22, 28],
  ["Stale information", 26, 28],
  ["Resolved task", 28, 28],
  ["Correct recipient", 11, 13],
  ["Unanswered request", 12, 13],
] as const;

export default function Home() {
  return <>
    <header><p className="kicker">Overview</p><h1>Hey, I’m Jem<span>.</span></h1>
      <p className="intro">I build AI agents and the tools to evaluate them.</p>
      <p>My current project is <a href="https://earcue.lol">EarCue</a>. It reads your inbox, chats and calendar, picks up to three things worth doing, and drafts replies in your voice.</p>
    </header>
    <section><h2>Featured work</h2>
      <article className="feature">
        <a className="cover" href="https://earcue.lol" aria-label="Visit EarCue"><span>earcue</span></a>
        <div className="panel"><p className="kicker">Model evaluation</p>
          <h3>EarCue eval dashboard</h3>
          <p>Can a second model spot a misleading recommendation? I compared its verdicts with hand-labelled examples across five checks.</p>
          <figure><figcaption>Verifier agreement <small>Agreed / tested</small></figcaption>
            {verifier.map(([name, agreed, total]) => <div className="metric" key={name}><span>{name}</span><i aria-hidden="true" style={{backgroundSize: `${100 * agreed / total}% 100%`}}/><code>{agreed}/{total}</code></div>)}
          </figure>
          <a className="action" href="https://evals.earcue.lol">Open eval dashboard</a>
        </div>
      </article>
    </section>
    <footer><Link href="/engineering/">Explore my AI engineering work</Link></footer>
  </>;
}
