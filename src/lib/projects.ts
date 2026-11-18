import data from "./projects.json";

export type Project = {
  name: string;
  type: string;
  description?: string;
  url?: string;
  featured?: boolean;
};

export const projects: Project[] = data;
