import { redirect } from "next/navigation";

/** Old nested route → top-level /swipe */
export default function PeopleSwipeRedirect({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const q = searchParams?.tab === "likes" ? "?tab=likes" : "";
  redirect(`/swipe${q}`);
}
