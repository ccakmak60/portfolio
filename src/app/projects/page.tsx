import { projects } from "@/lib/projects";

export const metadata = { title: "Projects" };

export default function Projects() {
  return <><header><p className="kicker">Portfolio</p><h1>Projects<span>.</span></h1><p className="intro">Products, experiments and open-source tools I’ve worked on.</p></header>
    <ul className="projects">{projects.map(project => <li key={project.name}>
      <div><h2>{project.url ? <a href={project.url}>{project.name}</a> : project.name}</h2><small>{project.type}</small></div>
      {project.description && <p>{project.description}</p>}
    </li>)}</ul></>;
}
