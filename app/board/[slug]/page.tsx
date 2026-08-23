import { PublicBoard } from "@/components/PublicBoard";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BoardPage({ params }: PageProps) {
  const { slug } = await params;
  return <PublicBoard slug={slug} />;
}
