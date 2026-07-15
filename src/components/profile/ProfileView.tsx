"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Pencil,
  MapPin,
  Calendar,
  Save,
  X,
  MessageCircle,
  Camera,
  Loader2,
  MessageSquare,
  CheckCircle2,
  Trash2,
  ImagePlus,
  Shield,
  Crown,
} from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { AvatarCropper } from "@/components/ui/AvatarCropper";
import { PhotoLightbox } from "@/components/ui/PhotoLightbox";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileWall } from "@/components/profile/ProfileWall";
import { usePhotoViewLimit } from "@/hooks/usePhotoViewLimit";
import { ageFromBirthDate, isOnline, timeAgo } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getCountries, getRegions, getCities } from "@/lib/data/locations";
import {
  DATING_GOALS,
  GENDER_OPTIONS,
  SEXUAL_INTERESTS,
  LOOKING_FOR_OPTIONS,
  AGE_PREFERENCE_OPTIONS,
  MEETING_PLACE_OPTIONS,
  MOBILITY_OPTIONS,
  SMOKING_ATTITUDE_OPTIONS,
  DRINKING_ATTITUDE_OPTIONS,
  ORIENTATION_ROLES,
  BREAST_SIZE_OPTIONS,
  PENIS_SIZE_OPTIONS,
  getDatingGoalLabel,
  getLookingForLabel,
  getSmokingAttitudeLabel,
  getDrinkingAttitudeLabel,
  getMobilityLabel,
  normalizeDatingGoal,
  normalizeLookingFor,
  normalizeOrientationValues,
  normalizeSmokingAttitude,
  normalizeDrinkingAttitude,
  normalizeSexualInterests,
  getOrientationLabel,
  getLabel,
} from "@/lib/data/profileOptions";
import type { Profile, ProfilePhoto } from "@/lib/types";

interface ProfileViewProps {
  profile: Profile;
  photos: ProfilePhoto[];
  isOwn: boolean;
  isPremium?: boolean;
}

function InlineChoices({
  options,
  selected,
  onToggle,
  singleLine = false,
}: {
  options: readonly { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  singleLine?: boolean;
}) {
  return (
    <div className={`flex items-center gap-x-1.5 text-sm ${singleLine ? "overflow-x-auto whitespace-nowrap pb-1" : "flex-wrap gap-y-1"}`}>
      {options.map((option, index) => (
        <span key={option.value} className="inline-flex shrink-0 items-center gap-x-1.5">
          {index > 0 && <span className="select-none text-slate-500">/</span>}
          <button
            type="button"
            aria-pressed={selected.includes(option.value)}
            onClick={() => onToggle(option.value)}
            className={`px-0.5 py-1 text-left transition-colors ${selected.includes(option.value) ? "font-bold text-warm-100 underline decoration-gold/60 underline-offset-4" : "font-normal text-slate-400 hover:text-warm-100"}`}
          >
            {option.label}
          </button>
        </span>
      ))}
    </div>
  );
}

export function ProfileView({ profile, photos, isOwn, isPremium = false }: ProfileViewProps) {
  const supabase = createClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [localPhotos, setLocalPhotos] = useState(photos);
  const [available, setAvailable] = useState(profile.available_for_chat);
  const [friendStatus, setFriendStatus] = useState<"none" | "sent" | "received" | "accepted">("none");

  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperSrc, setCropperSrc] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isAdminViewer, setIsAdminViewer] = useState(false);

  useEffect(() => {
    async function checkRoleAndFriendship() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: viewerProfile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (viewerProfile?.role === "admin") {
          setIsAdminViewer(true);
        }

        if (!isOwn) {
          const { data: existing } = await (supabase as any)
            .from("friendships")
            .select("id, status, requester_id")
            .or(`and(requester_id.eq.${user.id},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${user.id})`)
            .maybeSingle();
          if (existing) {
            if (existing.status === "accepted") {
              setFriendStatus("accepted");
            } else if (existing.status === "pending") {
              setFriendStatus(existing.requester_id === user.id ? "sent" : "received");
            }
          }
        }
      }
    }
    checkRoleAndFriendship();
  }, [supabase, isOwn, profile.id]);

  const photoLimit = usePhotoViewLimit(isOwn ? null : profile.id, isPremium);

  const [form, setForm] = useState({
    username: profile.username,
    display_name: profile.display_name ?? "",
    status: profile.status ?? "",
    bio: profile.bio ?? "",
    country: profile.country ?? "",
    region: profile.region ?? "",
    city: profile.city ?? "",
    birth_date: profile.birth_date ?? "",
    gender: profile.gender ?? "prefer_not_to_say",
    dating_goal: profile.dating_goal ?? "",
    dating_goals: profile.dating_goals?.length
      ? profile.dating_goals.map(normalizeDatingGoal).filter(Boolean)
      : profile.dating_goal
        ? [normalizeDatingGoal(profile.dating_goal)].filter((value): value is string => Boolean(value))
        : [],
    interests: normalizeSexualInterests(profile.interests).join(", "),
    looking_for: normalizeLookingFor(profile.looking_for),
    age_preference: profile.age_preference ?? "",
    meeting_place: profile.meeting_place ?? [],
    mobility: profile.mobility ?? "",
    height: profile.height ?? "",
    weight: profile.weight ?? "",
    breast_size: profile.breast_size ?? "",
    penis_size: profile.penis_size ?? "",
    smoking_attitude: normalizeSmokingAttitude(profile.smoking_attitude),
    drinking_attitude: normalizeDrinkingAttitude(profile.drinking_attitude),
    orientation_roles: normalizeOrientationValues(profile.orientation_roles),
  });

  const online = isOnline(profile.last_seen);

  const countries = useMemo(() => getCountries(), []);
  const regions = useMemo(() => getRegions(form.country), [form.country]);
  const cities = useMemo(() => getCities(form.country, form.region), [form.country, form.region]);

  useEffect(() => {
    setAvailable(profile.available_for_chat);
  }, [profile.available_for_chat]);

  useEffect(() => {
    setLocalPhotos(photos);
  }, [photos]);

  useEffect(() => {
    async function logVisit() {
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user && auth.user.id !== profile.id) {
        try {
          const { data: existing } = await (supabase as any)
            .from("profile_visits")
            .select("id")
            .eq("profile_id", profile.id)
            .eq("visitor_id", auth.user.id)
            .limit(1);

          if (existing && existing.length > 0) {
            await (supabase as any)
              .from("profile_visits")
              .update({ visited_at: new Date().toISOString() })
              .eq("id", existing[0].id);
          } else {
            await (supabase as any)
              .from("profile_visits")
              .insert({
                profile_id: profile.id,
                visitor_id: auth.user.id,
                visited_at: new Date().toISOString()
              });
          }
        } catch (err) {
          console.error("Failed to log profile visit from client:", err);
        }
      }
    }
    logVisit();
  }, [profile.id, supabase]);

  async function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCropperSrc(ev.target?.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);

    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleCroppedAvatar(blob: Blob) {
    setCropperOpen(false);
    setUploadingAvatar(true);

    try {
      const ext = "jpg";
      const filePath = `${profile.id}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await (supabase as any).storage
        .from("avatars")
        .upload(filePath, blob, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: urlData } = await (supabase as any).storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = urlData?.publicUrl ?? null;

      await (supabase as any)
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", profile.id);

      router.refresh();
    } catch (err) {
      console.error("Avatar upload error:", err);
    }

    setUploadingAvatar(false);
  }

  async function handleProfilePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadingPhoto(true);
    setPhotoError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== profile.id) {
      setPhotoError("Нужно войти в свой аккаунт, чтобы добавлять фото.");
      setUploadingPhoto(false);
      return;
    }

    for (const file of files) {
      try {
        if (!file.type.startsWith("image/")) {
          throw new Error("Можно загружать только изображения.");
        }

        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${profile.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;

        const { error: uploadError } = await (supabase as any).storage
          .from("profile-photos")
          .upload(path, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = await (supabase as any).storage
          .from("profile-photos")
          .getPublicUrl(path);

        const { data: insertedPhoto, error: insertError } = await (supabase as any)
          .from("profile_photos")
          .insert({
            user_id: profile.id,
            url: urlData.publicUrl,
            storage_path: path,
            sort_order: localPhotos.length,
          })
          .select("*")
          .single();

        if (insertError) {
          await (supabase as any).storage.from("profile-photos").remove([path]);
          throw insertError;
        }

        setLocalPhotos((prev) => [
          (insertedPhoto ?? {
            id: path,
            user_id: profile.id,
            url: urlData.publicUrl,
            storage_path: path,
            caption: null,
            sort_order: prev.length,
            created_at: new Date().toISOString(),
          }) as ProfilePhoto,
          ...prev,
        ]);
      } catch (err: any) {
        console.error("Profile photo upload error:", err);
        setPhotoError(
          err?.message?.includes("profile_photos") ||
            err?.message?.includes("relation") ||
            err?.message?.includes("bucket")
            ? "В Supabase еще не применена таблица profile_photos или bucket profile-photos. Примените обновленный supabase/schema.sql."
            : `Не удалось добавить фото: ${err?.message ?? "неизвестная ошибка"}`
        );
      }
    }

    if (photoRef.current) photoRef.current.value = "";
    setUploadingPhoto(false);
  }

  async function deleteProfilePhoto(photo: ProfilePhoto) {
    setPhotoError("");
    setLocalPhotos((prev) => prev.filter((item) => item.id !== photo.id));

    const { error: deleteError } = await (supabase as any)
      .from("profile_photos")
      .delete()
      .eq("id", photo.id)
      .eq("user_id", profile.id);

    const { error: storageError } = await (supabase as any).storage
      .from("profile-photos")
      .remove([photo.storage_path]);

    if (deleteError || storageError) {
      console.error("Profile photo delete error:", deleteError ?? storageError);
      setPhotoError("Не удалось удалить фото. Обновите страницу и попробуйте снова.");
      router.refresh();
    }
  }

  async function toggleAvailable() {
    const next = !available;
    setAvailable(next);
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ available_for_chat: next })
      .eq("id", profile.id);

    if (error) {
      setAvailable(!next);
      console.error("Available status update error:", error);
      alert(`Ошибка: ${error.message}\nВозможно, в таблице profiles в Supabase отсутствует колонка available_for_chat.`);
    } else {
      router.refresh();
    }
  }

  async function sendFriendRequest() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user || isOwn) return;
    const { error } = await (supabase as any).from("friendships").insert({
      requester_id: auth.user.id,
      addressee_id: profile.id,
    });
    if (!error || error.code === "23505") setFriendStatus("sent");
  }

  async function acceptFriendRequest() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await (supabase as any)
      .from("friendships")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("requester_id", profile.id)
      .eq("addressee_id", auth.user.id);
    if (!error) {
      setFriendStatus("accepted");
      router.refresh();
    }
  }

  async function removeFriendship() {
    if (!confirm("Вы уверены, что хотите удалить этого пользователя из друзей?")) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await (supabase as any)
      .from("friendships")
      .delete()
      .or(`and(requester_id.eq.${auth.user.id},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${auth.user.id})`);
    if (!error) {
      setFriendStatus("none");
      router.refresh();
    }
  }

  async function handleSave() {
    const supa = supabase as any;
    setSaving(true);
    setUsernameError("");
    setSaveError("");

    const newUsername = form.username.trim().toLowerCase();
    if (newUsername !== profile.username) {
      const { data: existing } = await supa
        .from("profiles")
        .select("id")
        .eq("username", newUsername)
        .maybeSingle();

      if (existing) {
        setUsernameError("Этот username уже занят");
        setSaving(false);
        return;
      }

      if (newUsername.length < 3) {
        setUsernameError("Минимум 3 символа");
        setSaving(false);
        return;
      }

      if (!/^[a-z0-9_]+$/.test(newUsername)) {
        setUsernameError("Только латиница, цифры и _");
        setSaving(false);
        return;
      }
    }

    const interests = form.interests
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const profileUpdate: Record<string, unknown> = {
      username: newUsername,
      display_name: form.display_name.replace(/[^А-Яа-яЁё]/g, "").slice(0, 10) || null,
      status: form.status || null,
      bio: form.bio || null,
      country: form.country || null,
      region: form.region || null,
      city: form.city || null,
      birth_date: form.birth_date && form.birth_date.split("-").every(Boolean) && form.birth_date.split("-").length === 3 ? form.birth_date : null,
      gender: form.gender,
      dating_goal: form.dating_goals[0] || null,
      dating_goals: form.dating_goals,
      interests,
      looking_for: form.looking_for,
      age_preference: form.age_preference || null,
      meeting_place: form.meeting_place,
      mobility: form.mobility || null,
      height: form.height ? Number(form.height) : null,
      weight: form.weight ? Number(form.weight) : null,
      breast_size: form.breast_size || null,
      penis_size: form.penis_size || null,
      smoking_attitude: form.smoking_attitude || null,
      drinking_attitude: form.drinking_attitude || null,
      orientation_roles: form.orientation_roles,
    };

    const { error: updateError } = await supa
      .from("profiles")
      .update(profileUpdate)
      .eq("id", profile.id);

    if (updateError) {
      console.error("Profile save error:", updateError);
      if (updateError.message?.includes("dating_goal") || updateError.message?.includes("dating_goals") || updateError.message?.includes("breast_size") || updateError.message?.includes("penis_size") || updateError.message?.includes("looking_for")) {
        const { dating_goals: _ds, breast_size: _bs, penis_size: _ps, ...fallbackUpdate } = profileUpdate;
        if (updateError.message?.includes("dating_goal") && !updateError.message?.includes("dating_goals")) {
          delete fallbackUpdate.dating_goal;
        }
        const { error: fallbackError } = await supa
          .from("profiles")
          .update(fallbackUpdate)
          .eq("id", profile.id);

        if (!fallbackError) {
          setSaveError(
            "Основные поля сохранены. Часть новых полей появится после применения обновлённого supabase/schema.sql."
          );
          setSaving(false);
          router.refresh();
          return;
        }
      }

      setSaveError(
        updateError.message?.includes("dating_goal") || updateError.message?.includes("dating_goals") || updateError.message?.includes("breast_size") || updateError.message?.includes("penis_size")
          ? "В Supabase еще не применена новая схема профиля. Примените supabase/schema.sql и сохраните профиль снова."
          : `Не удалось сохранить профиль: ${updateError.message}`
      );
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  const age = ageFromBirthDate(profile.birth_date);
  const profileDatingGoals = profile.dating_goals?.length
    ? profile.dating_goals
    : profile.dating_goal
      ? [profile.dating_goal]
      : [];
  const datingGoalLabels = profileDatingGoals
    .map((value) => getDatingGoalLabel(value) ?? value)
    .filter(Boolean);
  const agePrefLabel = getLabel(AGE_PREFERENCE_OPTIONS, profile.age_preference);
  const mobilityLabel = getMobilityLabel(profile.mobility);
  const smokingLabel = getSmokingAttitudeLabel(profile.smoking_attitude);
  const drinkingLabel = getDrinkingAttitudeLabel(profile.drinking_attitude);
  const breastSizeLabel = getLabel(BREAST_SIZE_OPTIONS, profile.breast_size) ?? profile.breast_size;
  const penisSizeLabel = profile.penis_size ? `${profile.penis_size} см` : null;
  const orientationLabels = (profile.orientation_roles ?? [])
    .map((value) => getOrientationLabel(value))
    .filter((value): value is string => Boolean(value));
  const lookingForLabels = (profile.looking_for ?? [])
    .map((value) => getLookingForLabel(value))
    .filter((value): value is string => Boolean(value));
  const meetingPlaceLabels = (profile.meeting_place ?? [])
    .map((value) => MEETING_PLACE_OPTIONS.find((option) => option.value === value)?.label ?? value);
  const intimatePreferenceLabels = normalizeSexualInterests(profile.interests);
  const selectedInterests = form.interests
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  function toggleInterest(interest: string) {
    const exists = selectedInterests.includes(interest);
    const next = exists
      ? selectedInterests.filter((item) => item !== interest)
      : [...selectedInterests, interest];
    setForm({ ...form, interests: next.join(", ") });
  }

  function toggleDatingGoal(value: string) {
    const exists = form.dating_goals.includes(value);
    const next = exists
      ? form.dating_goals.filter((v) => v !== value)
      : [...form.dating_goals, value];
    setForm({ ...form, dating_goals: next, dating_goal: next[0] ?? "" });
  }

  function toggleLookingFor(value: string) {
    const exists = form.looking_for.includes(value);
    const next = exists
      ? form.looking_for.filter((v) => v !== value)
      : [...form.looking_for, value];
    setForm({ ...form, looking_for: next });
  }

  function toggleMeetingPlace(value: string) {
    const exists = form.meeting_place.includes(value);
    const next = exists
      ? form.meeting_place.filter((v) => v !== value)
      : [...form.meeting_place, value];
    setForm({ ...form, meeting_place: next });
  }

  function selectOrientation(value: string) {
    setForm({
      ...form,
      orientation_roles: form.orientation_roles.includes(value) ? [] : [value],
    });
  }

  function setBirthDateFromComponents(year: string, month: string, day: string) {
    if (!year && !month && !day) {
      setForm({ ...form, birth_date: "" });
    } else {
      const paddedMonth = month ? month.padStart(2, "0") : "";
      const paddedDay = day ? day.padStart(2, "0") : "";
      setForm({ ...form, birth_date: `${year}-${paddedMonth}-${paddedDay}` });
    }
  }

  return (
    <div className="profile-no-shadows w-full min-w-0 space-y-5 overflow-x-clip">
      <AvatarCropper
        open={cropperOpen}
        imageSrc={cropperSrc}
        onCrop={handleCroppedAvatar}
        onClose={() => setCropperOpen(false)}
      />

      <PhotoLightbox
        open={lightboxOpen}
        photos={localPhotos.map((p) => ({ url: p.url, caption: p.caption }))}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />

      {!editing && <>
        <ProfileHeader profile={profile} isOwn={isOwn} available={available} onToggleAvailable={toggleAvailable} onEdit={() => setEditing(true)} />
        <div className="h-[13rem] sm:h-[10rem]" aria-hidden="true" />
      </>}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard
          className={editing
            ? "relative overflow-hidden p-4 shadow-none sm:p-6"
            : "relative overflow-visible border-0 bg-transparent p-4 shadow-none backdrop-blur-none sm:p-6"
          }
        >
          <div className="relative flex flex-col gap-3 pt-5 sm:flex-row sm:items-start sm:gap-4 sm:pt-7">
            <div className={editing ? "relative group w-fit shrink-0" : "hidden"}>
              <Avatar
                src={profile.avatar_url}
                name={profile.display_name ?? profile.username}
                size="xl"
                lastSeen={profile.last_seen}
                showPresence
              />
              <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-gold/20 blur-xl" />

              {isOwn && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileSelect}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
                  >
                    {uploadingAvatar ? (
                      <Loader2 size={20} className="animate-spin text-white" />
                    ) : (
                      <Camera size={20} className="text-white" />
                    )}
                  </button>
                </>
              )}
            </div>

            <div className="min-w-0 flex-1 pt-0.5 sm:pt-1">
              {editing ? (
                <div className="flex flex-col gap-3">
                  <div className="order-1">
                    <label className="mb-1.5 block text-xs font-bold text-slate-400">
                      Никнейм профиля
                    </label>
                    <Input
                      value={form.username}
                      onChange={(e) =>
                        setForm({ ...form, username: e.target.value })
                      }
                      placeholder="Как в Telegram, например boy_kowboy"
                    />
                    {usernameError && (
                      <p className="mt-1 text-xs text-red-400">{usernameError}</p>
                    )}
                  </div>
                  <div className="order-2">
                    <label className="mb-1.5 block text-xs font-bold text-slate-400">
                      Имя
                    </label>
                    <Input
                      value={form.display_name}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          display_name: e.target.value.replace(/[^А-Яа-яЁё]/g, "").slice(0, 10),
                        })
                      }
                      maxLength={10}
                      placeholder="Только русские буквы, до 10 символов"
                    />
                  </div>
                  <div className="order-8 border-t border-gold/20 pt-4">
                    <h3 className="mb-2 font-display text-lg font-bold text-warm-100">О себе:</h3>
                    <Textarea
                      value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value.slice(0, 2000) })}
                      placeholder="Расскажите о себе"
                      maxLength={2000}
                      rows={3}
                    />
                  </div>
                  <div className="order-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-normal text-slate-400">
                        <MapPin size={12} className="mr-1 inline" />
                        Локация
                      </label>
                      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                        <select
                          value={form.country}
                          onChange={(e) =>
                            setForm({ ...form, country: e.target.value, region: "", city: "" })
                          }
                          className="h-10 w-full min-w-0 rounded-xl border border-gold/15 bg-base-800/60 px-3 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                        >
                          <option value="">Страна</option>
                          {countries.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        {form.country && (
                          <select
                            value={form.region}
                            onChange={(e) =>
                              setForm({ ...form, region: e.target.value, city: "" })
                            }
                            className="h-10 w-full min-w-0 rounded-xl border border-gold/15 bg-base-800/60 px-3 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                          >
                            <option value="">Регион</option>
                            {regions.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        )}
                        {form.region && (
                          <select
                            value={form.city}
                            onChange={(e) =>
                              setForm({ ...form, city: e.target.value })
                            }
                            className="h-10 w-full min-w-0 rounded-xl border border-gold/15 bg-base-800/60 px-3 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                          >
                            <option value="">Город</option>
                            {cities.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        )}
                        {(form.country || form.region || form.city) && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm({ ...form, country: "", region: "", city: "" })
                            }
                            className="flex h-10 items-center justify-center gap-1 rounded-xl border border-gold/15 bg-base-800/60 px-3 text-xs text-slate-400 transition-all hover:text-white min-[420px]:justify-start"
                          >
                            <X size={12} />
                            Сбросить
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-normal text-slate-400">
                        Дата рождения
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <select
                          value={form.birth_date ? form.birth_date.split("-")[0] ?? "" : ""}
                          onChange={(e) => {
                            const parts = form.birth_date ? form.birth_date.split("-") : ["", "", ""];
                            setBirthDateFromComponents(e.target.value, parts[1] || "", parts[2] || "");
                          }}
                          className="h-10 min-w-0 rounded-xl border border-gold/15 bg-base-800/60 px-2 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15 sm:px-3"
                        >
                          <option value="">Год</option>
                          {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                        <select
                          value={form.birth_date ? form.birth_date.split("-")[1] ?? "" : ""}
                          onChange={(e) => {
                            const parts = form.birth_date ? form.birth_date.split("-") : ["", "", ""];
                            setBirthDateFromComponents(parts[0] || "", e.target.value, parts[2] || "");
                          }}
                          className="h-10 min-w-0 rounded-xl border border-gold/15 bg-base-800/60 px-2 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15 sm:px-3"
                        >
                          <option value="">Месяц</option>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                            const val = m.toString().padStart(2, "0");
                            return <option key={val} value={val}>{m}</option>;
                          })}
                        </select>
                        <select
                          value={form.birth_date ? form.birth_date.split("-")[2] ?? "" : ""}
                          onChange={(e) => {
                            const parts = form.birth_date ? form.birth_date.split("-") : ["", "", ""];
                            setBirthDateFromComponents(parts[0] || "", parts[1] || "", e.target.value);
                          }}
                          className="h-10 min-w-0 rounded-xl border border-gold/15 bg-base-800/60 px-2 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15 sm:px-3"
                        >
                          <option value="">День</option>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                            const val = d.toString().padStart(2, "0");
                            return <option key={val} value={val}>{d}</option>;
                          })}
                        </select>
                      </div>
                      {(() => {
                        const a = ageFromBirthDate(form.birth_date || null);
                        return a ? <p className="mt-1 text-xs text-slate-500">{a} лет</p> : null;
                      })()}
                    </div>
                  </div>
                  <div className="order-4">
                    <label className="mb-1.5 block text-xs font-bold text-slate-400">
                      Пол
                    </label>
                    <select
                      value={form.gender}
                      onChange={(e) => {
                        const gender = e.target.value as typeof form.gender;
                        setForm({
                          ...form,
                          gender,
                          breast_size: gender === "female" ? form.breast_size : "",
                          penis_size: gender === "male" ? form.penis_size : "",
                        });
                      }}
                      className="h-10 w-full rounded-xl border border-gold/15 bg-base-800/60 px-3.5 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                    >
                      {GENDER_OPTIONS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                      <option value="prefer_not_to_say">Не указывать</option>
                    </select>
                  </div>
                  <div className="order-6 space-y-4 border-t border-gold/20 pt-4">
                    <h3 className="font-display text-lg font-bold text-warm-100">Кого ищете:</h3>
                    <div>
                      <label className="mb-1 block text-sm font-bold text-warm-100">Цель знакомства:</label>
                      <InlineChoices
                        options={DATING_GOALS}
                        selected={form.dating_goals}
                        onToggle={toggleDatingGoal}
                        singleLine
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-bold text-warm-100">Кого хотелось бы найти:</label>
                      <InlineChoices
                        options={LOOKING_FOR_OPTIONS}
                        selected={form.looking_for}
                        onToggle={toggleLookingFor}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-warm-100">
                        Возраст тех, с кем Вы хотите познакомиться:
                      </label>
                      <select
                        value={form.age_preference}
                        onChange={(e) => setForm({ ...form, age_preference: e.target.value })}
                        className="h-10 w-full rounded-xl border border-gold/15 bg-base-800/60 px-3.5 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                      >
                        <option value="">Не указано</option>
                        {AGE_PREFERENCE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-bold text-warm-100">Предпочтительное место для встречи:</label>
                      <InlineChoices
                        options={MEETING_PLACE_OPTIONS}
                        selected={form.meeting_place}
                        onToggle={toggleMeetingPlace}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-warm-100">Степень вашей мобильности:</label>
                      <select
                        value={form.mobility}
                        onChange={(e) => setForm({ ...form, mobility: e.target.value })}
                        className="h-10 w-full rounded-xl border border-gold/15 bg-base-800/60 px-3.5 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                      >
                        <option value="">Не указано</option>
                        {MOBILITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="order-5 border-t border-gold/20 pt-4">
                    <h3 className="mb-3 font-display text-lg font-bold text-warm-100">Параметры:</h3>
                    <div className="mb-3">
                      <label className="mb-1 block text-sm font-bold text-warm-100">
                        Ориентация:
                      </label>
                      <InlineChoices
                        options={ORIENTATION_ROLES}
                        selected={form.orientation_roles}
                        onToggle={selectOrientation}
                        singleLine
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-sm font-bold text-warm-100">
                          Рост:
                        </label>
                        <Input
                          type="number"
                          min={100}
                          max={250}
                          value={form.height}
                          onChange={(e) => setForm({ ...form, height: e.target.value })}
                          placeholder="170"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-bold text-warm-100">
                          Вес:
                        </label>
                        <Input
                          type="number"
                          min={30}
                          max={300}
                          value={form.weight}
                          onChange={(e) => setForm({ ...form, weight: e.target.value })}
                          placeholder="65"
                        />
                      </div>
                    </div>
                    {form.gender === "female" && (
                      <div className="mt-3">
                        <label className="mb-1.5 block text-sm font-bold text-warm-100">
                          Размер груди:
                        </label>
                        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                          <select
                            value={BREAST_SIZE_OPTIONS.some((opt) => opt.value === form.breast_size) ? form.breast_size : ""}
                            onChange={(e) => setForm({ ...form, breast_size: e.target.value })}
                            className="h-10 w-full min-w-0 rounded-xl border border-gold/15 bg-base-800/60 px-3 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                          >
                            <option value="">Выбрать размер</option>
                            {BREAST_SIZE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <Input
                            value={BREAST_SIZE_OPTIONS.some((opt) => opt.value === form.breast_size) ? "" : form.breast_size}
                            onChange={(e) => setForm({ ...form, breast_size: e.target.value })}
                            placeholder="Или вручную"
                          />
                        </div>
                      </div>
                    )}
                    {form.gender === "male" && (
                      <div className="mt-3">
                        <label className="mb-1.5 block text-sm font-bold text-warm-100">
                          Размер члена (см):
                        </label>
                        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                          <select
                            value={PENIS_SIZE_OPTIONS.some((opt) => opt.value === form.penis_size) ? form.penis_size : ""}
                            onChange={(e) => setForm({ ...form, penis_size: e.target.value })}
                            className="h-10 w-full min-w-0 rounded-xl border border-gold/15 bg-base-800/60 px-3 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                          >
                            <option value="">Выбрать размер</option>
                            {PENIS_SIZE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={PENIS_SIZE_OPTIONS.some((opt) => opt.value === form.penis_size) ? "" : form.penis_size}
                            onChange={(e) => setForm({ ...form, penis_size: e.target.value })}
                            placeholder="Или вручную, см"
                          />
                        </div>
                      </div>
                    )}
                    <div className="mt-3">
                      <label className="mb-1.5 block text-sm font-bold text-warm-100">
                        Отношение к курению:
                      </label>
                      <select
                        value={form.smoking_attitude}
                        onChange={(e) => setForm({ ...form, smoking_attitude: e.target.value })}
                        className="h-10 w-full rounded-xl border border-gold/15 bg-base-800/60 px-3.5 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                      >
                        <option value="">Не указано</option>
                        {SMOKING_ATTITUDE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-3">
                      <label className="mb-1.5 block text-sm font-bold text-warm-100">
                        Отношение к алкоголю:
                      </label>
                      <select
                        value={form.drinking_attitude}
                        onChange={(e) => setForm({ ...form, drinking_attitude: e.target.value })}
                        className="h-10 w-full rounded-xl border border-gold/15 bg-base-800/60 px-3.5 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                      >
                        <option value="">Не указано</option>
                        {DRINKING_ATTITUDE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="order-7 border-t border-gold/20 pt-4">
                    <h3 className="mb-2 font-display text-lg font-bold text-warm-100">Интимные предпочтения:</h3>
                    <InlineChoices
                      options={SEXUAL_INTERESTS}
                      selected={SEXUAL_INTERESTS.filter((interest) => selectedInterests.includes(interest.label)).map((interest) => interest.value)}
                      onToggle={(value) => {
                        const interest = SEXUAL_INTERESTS.find((option) => option.value === value);
                        if (interest) toggleInterest(interest.label);
                      }}
                    />
                  </div>
                  <div className="order-10 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:flex">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      <Save size={14} />
                      {saving ? "…" : "Сохранить"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(false)}
                    >
                      <X size={14} />
                      Отмена
                    </Button>
                  </div>
                  {saveError && (
                    <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      {saveError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col">
                   <div className="hidden">
                    <div className="min-w-0">
                      <h1 className="flex min-w-0 flex-wrap items-center gap-1.5 break-words font-display text-lg font-bold leading-tight text-gradient sm:gap-2 sm:text-xl">
                        {(profile.display_name ?? profile.username).slice(0, 10)}
                        {profile.role === "admin" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]">
                            <Shield size={10} className="fill-current" />
                            Админ
                          </span>
                        )}
                        {profile.premium_until && new Date(profile.premium_until) > new Date() && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 border border-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-soft shadow-glow-gold">
                            <Crown size={10} className="fill-current" />
                            PRO
                          </span>
                        )}
                        {(available || isOwn) && (
                          isOwn ? (
                            <button
                              type="button"
                              onClick={toggleAvailable}
                              className={`inline-flex min-h-8 max-w-full touch-manipulation items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none shadow-inner-glow transition-all ${
                                available
                                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:border-emerald-500/45 dark:text-emerald-400"
                                  : "border border-gold/25 bg-base-900/65 text-warm-200 hover:border-gold/45 dark:text-white"
                              }`}
                            >
                              {available ? <CheckCircle2 size={12} /> : <MessageSquare size={12} />}
                              {available ? "Готов(а) общаться" : "Не готов(а) общаться"}
                            </button>
                          ) : (
                            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold leading-none text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={12} />
                              Готов(а) общаться
                            </span>
                          )
                        )}
                      </h1>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        @{profile.username}
                      </p>
                    </div>
                    {isOwn && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-mr-1 -mt-1 shrink-0"
                        onClick={() => setEditing(true)}
                      >
                        <Pencil size={16} />
                      </Button>
                    )}
                  </div>

                  <div className="hidden">
                    {profile.gender && profile.gender !== "prefer_not_to_say" && (
                      <span className="flex items-center gap-1">
                        {profile.gender === "male"
                          ? "👨 Мужчина"
                          : profile.gender === "female"
                          ? "👩 Женщина"
                          : profile.gender === "couple_mf"
                          ? "👫 Пара МЖ"
                          : profile.gender}
                      </span>
                    )}
                    {profile.city && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {profile.city}
                      </span>
                    )}
                    {age && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {age} лет
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          online ? "bg-emerald-glow shadow-glow-emerald" : "bg-slate-600"
                        }`}
                      />
                      {online ? "В сети" : `Был(а) ${timeAgo(profile.last_seen)}`}
                    </span>
                  </div>

                  <div className="order-3 w-full border-y border-gold/20 bg-base-800/35 px-3.5 text-sm leading-6 text-slate-300 sm:px-5 sm:text-[15px]">
                    <section className="space-y-1 py-4">
                      <h2 className="mb-2 font-display text-xl font-bold text-warm-100">Параметры:</h2>
                      {orientationLabels.length > 0 && (
                        <p className="overflow-x-auto whitespace-nowrap pb-1"><span className="font-bold text-warm-100">Ориентация:</span> {orientationLabels.join(" / ")}</p>
                      )}
                      {profile.height && <p><span className="font-bold text-warm-100">Рост:</span> {profile.height} см</p>}
                      {profile.weight && <p><span className="font-bold text-warm-100">Вес:</span> {profile.weight} кг</p>}
                      {profile.breast_size && profile.gender === "female" && <p><span className="font-bold text-warm-100">Размер груди:</span> {breastSizeLabel}</p>}
                      {profile.penis_size && profile.gender === "male" && <p><span className="font-bold text-warm-100">Размер члена:</span> {penisSizeLabel}</p>}
                      {smokingLabel && <p><span className="font-bold text-warm-100">Отношение к курению:</span> {smokingLabel}</p>}
                      {drinkingLabel && <p><span className="font-bold text-warm-100">Отношение к алкоголю:</span> {drinkingLabel}</p>}
                    </section>

                    <section className="space-y-1 border-t border-gold/20 py-4">
                      <h2 className="mb-2 font-display text-xl font-bold text-warm-100">Кого ищете:</h2>
                      {datingGoalLabels.length > 0 && (
                        <p className="overflow-x-auto whitespace-nowrap pb-1"><span className="font-bold text-warm-100">Цель знакомства:</span> {datingGoalLabels.join(" / ")}</p>
                      )}
                      {lookingForLabels.length > 0 && <p><span className="font-bold text-warm-100">Кого хотелось бы найти:</span> {lookingForLabels.join(" / ")}</p>}
                      {agePrefLabel && <p><span className="font-bold text-warm-100">Возраст тех, с кем Вы хотите познакомиться:</span> {agePrefLabel}</p>}
                      {meetingPlaceLabels.length > 0 && <p><span className="font-bold text-warm-100">Предпочтительное место для встречи:</span> {meetingPlaceLabels.join(" / ")}</p>}
                      {mobilityLabel && <p><span className="font-bold text-warm-100">Степень вашей мобильности:</span> {mobilityLabel}</p>}
                    </section>

                    <section className="border-t border-gold/20 py-4">
                      <h2 className="mb-2 font-display text-xl font-bold text-warm-100">Интимные предпочтения:</h2>
                      <p>{intimatePreferenceLabels.length > 0 ? intimatePreferenceLabels.join(" / ") : "Не указано"}</p>
                    </section>

                    <section className="border-t border-gold/20 py-4">
                      <h2 className="mb-2 font-display text-xl font-bold text-warm-100">О себе:</h2>
                      <p className="whitespace-pre-wrap break-words">
                        {profile.bio?.trim() ||
                          (isOwn
                            ? "Расскажите немного о себе — это поможет другим участникам лучше вас узнать."
                            : "Пользователь пока ничего о себе не рассказал.")}
                      </p>
                    </section>
                  </div>

                  {!isOwn && (
                    <div className="order-8 mt-4 flex flex-wrap gap-2">
                      <Link href={`/chat/${profile.id}`}>
                        <Button size="sm">
                          <MessageCircle size={14} />
                          Написать сообщение
                        </Button>
                      </Link>
                       {friendStatus === "none" && (
                         <Button variant="outline" size="sm" onClick={sendFriendRequest}>
                           Добавить в друзья
                         </Button>
                       )}
                       {friendStatus === "sent" && (
                         <Button variant="outline" size="sm" disabled>
                           Заявка отправлена
                         </Button>
                       )}
                       {friendStatus === "received" && (
                         <Button className="border border-emerald-500/30 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/35" size="sm" onClick={acceptFriendRequest}>
                           Принять заявку
                         </Button>
                       )}
                       {friendStatus === "accepted" && (
                         <Button variant="ghost" className="border border-red-500/20 text-red-400 hover:bg-red-500/10" size="sm" onClick={removeFriendship}>
                           Удалить из друзей
                         </Button>
                       )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {!editing && <ProfileWall profileId={profile.id} isOwn={isOwn} />}

      <GlassCard className="p-5">
        <div className="mb-4 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-warm-100">
              Фото профиля
            </h2>
            <p className="text-xs text-slate-500">
              Личные фото, которые видны на странице профиля
            </p>
          </div>
          {isOwn && (
            <>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleProfilePhotoUpload}
              />
              <Button
                type="button"
                size="sm"
                className="w-full min-[420px]:w-auto"
                onClick={() => photoRef.current?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ImagePlus size={14} />
                )}
                Добавить
              </Button>
            </>
          )}
        </div>

        {photoError && (
          <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {photoError}
          </p>
        )}

        {localPhotos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gold/15 bg-base-900/30 p-8 text-center">
            <p className="text-sm text-slate-400">
              {isOwn
                ? "Добавьте первое фото, чтобы профиль выглядел живее."
                : "Пользователь пока не добавил фото."}
            </p>
          </div>
        ) : (
          <>
            {!isOwn && !isPremium && (
              <div className="mb-3 flex items-center justify-between rounded-lg border border-gold/10 bg-base-900/40 px-3 py-2">
                <span className="text-xs text-slate-400">
                  Просмотров фото: {photoLimit.viewedCount} / {photoLimit.limit}
                </span>
                {photoLimit.limitReached ? (
                  <Link href="/premium">
                    <Button variant="gold" size="sm">
                      <Crown size={12} />
                      Докупить Premium
                    </Button>
                  </Link>
                ) : (
                  <span className="text-xs text-emerald-400">
                    Осталось: {photoLimit.remaining}
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {localPhotos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-gold/10 bg-base-900"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!isOwn && !isPremium && photoLimit.limitReached) {
                          return;
                        }
                        if (!isOwn && !isPremium) {
                          const allowed = photoLimit.recordView(photo.id);
                          if (!allowed) return;
                        }
                        setLightboxIndex(idx);
                        setLightboxOpen(true);
                      }}
                      className="absolute inset-0"
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption ?? "Фото профиля"}
                        className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                          !isOwn && !isPremium && photoLimit.limitReached
                            ? "blur-md brightness-50"
                            : ""
                        }`}
                      />
                      {!isOwn && !isPremium && photoLimit.limitReached && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                          <Crown size={24} className="text-gold" />
                          <span className="text-xs text-gold-soft">
                            Лимит исчерпан
                          </span>
                          <Link
                            href="/premium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="gold" size="sm">
                              Докупить Premium
                            </Button>
                          </Link>
                        </div>
                      )}
                    </button>
                    {(isOwn || isAdminViewer) && (
                      <button
                        type="button"
                        onClick={() => deleteProfilePhoto(photo)}
                        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg border border-red-400/20 bg-black/60 text-red-200 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                        aria-label="Удалить фото"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
              ))}
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}
