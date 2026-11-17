import axios from "axios";

import { getLlmKey } from "./llmKey";

const configuredBaseURL = import.meta.env.VITE_API_BASE_URL;
const baseURL = (configuredBaseURL || "http://127.0.0.1:8000/api/v1").replace(
  /\/+$/,
  "",
);
const token = import.meta.env.VITE_API_TOKEN;

export const API = axios.create({
  baseURL,
  timeout: 120_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
});

API.interceptors.request.use((config) => {
  const key = getLlmKey();
  if (key) config.headers.set("X-LLM-Key", key);
  return config;
});

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ detail?: unknown }>(error)) {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;

    if (typeof detail === "string" && detail.trim()) return detail;

    if (Array.isArray(detail) && detail.length > 0) {
      const messages = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (
            item &&
            typeof item === "object" &&
            "msg" in item &&
            typeof (item as { msg?: unknown }).msg === "string"
          ) {
            return (item as { msg: string }).msg;
          }
          return null;
        })
        .filter((msg): msg is string => Boolean(msg && msg.trim()));
      if (messages.length > 0) return messages.join("; ");
    }

    if (status === 413) {
      return "Attachment is too large. Please select smaller files and try again.";
    }
    if (status === 415) {
      return "Unsupported file type. Please attach a supported format (.pdf, .docx, .md, .txt, .csv, .json).";
    }
    if (status === 422) {
      return "Invalid message or attachment payload. Check your input and try again.";
    }
    if (error.code === "ECONNABORTED") {
      return "The API took too long to respond. Try again.";
    }
    if (!error.response) {
      return "Could not reach the API. Check that the backend is running.";
    }
  }

  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
