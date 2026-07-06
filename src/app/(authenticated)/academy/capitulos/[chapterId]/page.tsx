import { redirect } from "next/navigation";
import { academyCourse } from "@/lib/academy/course";

export default async function LegacyAcademyChapterPage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const { chapterId } = await params;

  redirect(`/academy/cursos/${academyCourse.slug}/capitulos/${chapterId}`);
}
