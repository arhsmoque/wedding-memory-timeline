import { validateDisplayName } from "./contentPolicy";

const PROFILE_KEY = "ash2026_guest_profile_v1";

export type GuestProfile = {
  displayName: string;
  editCount: number;
};

export function readGuestProfile(): GuestProfile {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as Partial<GuestProfile>;
    return {
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
      editCount: typeof parsed.editCount === "number" ? parsed.editCount : 0,
    };
  } catch {
    return { displayName: "", editCount: 0 };
  }
}

export function canEditGuestName(profile = readGuestProfile()) {
  return !profile.displayName || profile.editCount < 1;
}

export function saveGuestName(rawName: string): GuestProfile {
  const displayName = validateDisplayName(rawName);
  const current = readGuestProfile();
  const nameChanged = Boolean(current.displayName) && current.displayName !== displayName;
  if (nameChanged && current.editCount >= 1) {
    throw new Error("This device has already used its one name edit.");
  }
  const next = {
    displayName,
    editCount: nameChanged ? current.editCount + 1 : current.editCount,
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}

export function requireGuestName() {
  const profile = readGuestProfile();
  return validateDisplayName(profile.displayName);
}
