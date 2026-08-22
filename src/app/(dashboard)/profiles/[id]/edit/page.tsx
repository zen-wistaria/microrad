import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProfilePage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/ppp-profiles/${id}/edit`);
}
