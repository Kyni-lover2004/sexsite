import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MediaLibrary } from "@/components/profile/MediaLibrary";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MyPhotosPage() { const supabase=createClient(); const {data:auth}=await supabase.auth.getUser(); if(!auth.user) redirect("/login?next=/my-photos"); const {data}=await (supabase as any).from("profile_photos").select("*").eq("user_id",auth.user.id).order("created_at",{ascending:false}); return <AppShell><div className="space-y-5"><div><h1 className="font-display text-2xl font-bold text-warm-100">Мои фото</h1><p className="text-sm text-slate-500">Управление фотографиями вашей анкеты</p></div><MediaLibrary kind="photo" userId={auth.user.id} initialItems={data??[]}/></div></AppShell>; }
