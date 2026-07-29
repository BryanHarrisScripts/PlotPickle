import { createHash } from "node:crypto";

export type MeetConferenceStatus = "none" | "pending" | "success" | "failure";

export type SanitizedMeetConference = {
  meetingId: string;
  meetUrl: string;
  conferenceStatus: MeetConferenceStatus;
};

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" ? value as JsonObject : {};
}

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function safeMeetUrl(value: unknown) {
  const text = cleanText(value, 1_300);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.hostname !== "meet.google.com" || url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function meetConferenceRequestId(projectId: string, eventId: string) {
  return createHash("sha256")
    .update(`plotpickle-meet\0${projectId}\0${eventId}`)
    .digest("hex")
    .slice(0, 64);
}

export function createMeetConferenceData(projectId: string, eventId: string): JsonObject {
  return {
    createRequest: {
      requestId: meetConferenceRequestId(projectId, eventId),
      conferenceSolutionKey: { type: "hangoutsMeet" },
    },
  };
}

export function preserveOrCreateMeetConference(value: unknown, projectId: string, eventId: string): JsonObject {
  const existing = object(value);
  return Object.keys(existing).length ? existing : createMeetConferenceData(projectId, eventId);
}

export function sanitizeMeetConference(value: unknown): SanitizedMeetConference {
  const conference = object(value);
  const request = object(conference.createRequest);
  const requestStatus = object(request.status).statusCode;
  const solutionType = object(object(conference.conferenceSolution).key).type
    || object(request.conferenceSolutionKey).type;
  const entryPoints = Array.isArray(conference.entryPoints)
    ? conference.entryPoints.map(object)
    : [];
  const video = entryPoints.find((entry) => entry.entryPointType === "video");
  const meetUrl = safeMeetUrl(video?.uri);
  const isGoogleMeet = solutionType === "hangoutsMeet" || Boolean(meetUrl);
  const conferenceStatus: MeetConferenceStatus = requestStatus === "pending"
    || requestStatus === "success"
    || requestStatus === "failure"
    ? requestStatus
    : meetUrl ? "success" : "none";

  return {
    meetingId: isGoogleMeet ? cleanText(conference.conferenceId, 128) : "",
    meetUrl: isGoogleMeet ? meetUrl : "",
    conferenceStatus,
  };
}
