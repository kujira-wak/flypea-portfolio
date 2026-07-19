import aboutData from "./about.json";

interface AboutData {
  meta: { title: string; description: string; pathname: string };
  intro: { name: string; label: string; description: string };
  interests: string[];
  links: Array<{ label: string; href: string; description: string }>;
}

for (const link of aboutData.links) new URL(link.href);

export const aboutContent: AboutData = aboutData;
