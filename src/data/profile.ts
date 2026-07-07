import { siteConfig } from "../config/site";

type ProfileImage = {
  src: string;
  alt: string;
};

export const profileContent = {
  meta: {
    title: "Profile",
    description: "flypea.techを作っている人の軽い自己紹介ページです。",
    pathname: "/profile/",
  },
  profile: {
    name: "flypea",
    role: "Web development learner / portfolio builder",
    image: null as ProfileImage | null,
    fallbackInitials: "fp",
    description:
      "Web制作とWebアプリ開発を、作りながら学んでいます。flypea.techでは、制作物だけでなく、調べたこと、詰まったこと、公開までの流れも残していきます。",
    currentMode: "静的サイトを入口に、制作と学習を積み上げる。",
  },
  links: [
    {
      label: "GitHub",
      href: "https://github.com/kujira-wak",
      icon: "github",
      description: "コードと制作ログ",
    },
    {
      label: "Repository",
      href: siteConfig.githubUrl,
      icon: "code",
      description: "このサイトのリポジトリ",
    },
    {
      label: "Website",
      href: siteConfig.url,
      icon: "site",
      description: "公開中のポートフォリオ",
    },
  ],
  focusItems: [
    {
      title: "小さく作って公開する",
      description: "まずは静的サイトとして軽く公開し、動く状態を保ちながら少しずつ広げます。",
    },
    {
      title: "学習を見える形にする",
      description: "完成したものだけでなく、試行錯誤や判断の理由もログとして残します。",
    },
    {
      title: "Webアプリへ段階的に進む",
      description: "Astroの土台から、Next.js、SolidJS、データベース、テストへ進めていきます。",
    },
  ],
  nowItems: [
    "Astro + TypeScript + Tailwind CSS v4でポートフォリオを構築",
    "GitHub ActionsからロリポップへSFTPデプロイ",
    "CloudflareでHTTPSとwwwリダイレクトを管理",
    "学習ログと制作物一覧をMarkdownで育てる準備",
  ],
  nextItems: [
    "WorksとLearning Logをcontent collection化",
    "制作物の詳細ページを追加",
    "app.flypea.techや別リポジトリでWebアプリ学習を開始",
  ],
} as const;
