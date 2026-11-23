export const metadata = { title: "AI engineering" };

const notes = [
  { title: "Evaluating the verifier", href: "data", link: "Inspect data quality", text: "A draft can quote the right conversation and still address the wrong person. I tested the verifier against labelled synthetic cases, then broke agreement down by question so failures like these are visible." },
  { title: "Retrieving evidence across a graph", href: "retrieval", link: "Explore retrieval experiments", text: "I built paired recall tests where an answer depends on a fact attached to a related entity. Running the same project question with graph traversal disabled and with two hops lets me inspect which evidence reaches the answer and whether the citations resolve." },
  { title: "Catching prompt regressions", href: "release", link: "See release checks", text: "I built a CI replay suite around 45 synthetic inbox, drafting and recall cases. It checks evidence, language and output constraints before comparing judge scores with a baseline. Replay uses saved responses and verdicts. A separate live mode measures model behaviour." },
];

export default function Engineering() {
  return <><header><p className="kicker">EarCue</p><h1>AI engineering<span>.</span></h1><p className="intro">How I test what an agent retrieves, recommends and writes.</p></header>
    {notes.map(note => <section className="note" key={note.href}><h2>{note.title}</h2><p>{note.text}</p><a href={`https://evals.earcue.lol/${note.href}.html`}>{note.link}</a></section>)}</>;
}
