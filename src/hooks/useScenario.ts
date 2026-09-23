import { useEffect, useRef, useState } from "react";
import type {
  Category,
  Configuration,
  Decision,
  Preview,
} from "../types/simulation";
import { createScenario, previewScenario } from "../api/scenarios";
import { readDraft, saveDraft } from "../api/storage";
import {
  initiativeFor,
  replaceDecision,
  totalCost,
  validateDecisions,
} from "../utils/decisions";
import { errorMessage } from "../utils/format";

export function useScenario(config: Configuration) {
  const [decisions, setDecisions] = useState<Decision[]>(() =>
    readDraft(config),
  );
  const [preview, setPreview] = useState<{
    key: string;
    value: Preview;
  } | null>(null);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [retry, setRetry] = useState(0);
  const submissionLock = useRef(false);
  const sequence = useRef(0);
  const key = JSON.stringify(decisions);

  useEffect(() => {
    saveDraft(config, decisions);
    const id = ++sequence.current;
    const controller = new AbortController();
    setPreviewError("");
    const timer = setTimeout(() => {
      previewScenario(
        { dataset_version: config.dataset_version, decisions },
        controller.signal,
      )
        .then((value) => {
          if (!controller.signal.aborted && id === sequence.current)
            setPreview({ key, value });
        })
        .catch((e) => {
          if (!controller.signal.aborted && id === sequence.current)
            setPreviewError(errorMessage(e));
        });
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [config, decisions, key, retry]);

  const isCurrent = preview?.key === key;
  const change = (next: Decision) => {
    if (submissionLock.current) return;
    try {
      setDecisions(replaceDecision(config, decisions, next));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const remove = (category: Category) => {
    if (submissionLock.current) return;
    setDecisions(
      decisions.filter((d) => initiativeFor(config, d)?.category !== category),
    );
    setError("");
  };
  const submit = async () => {
    if (submissionLock.current || !isCurrent || !preview?.value.complete)
      return null;
    submissionLock.current = true;
    setSubmitting(true);
    setError("");
    try {
      validateDecisions(config, decisions, true);
      return await createScenario({
        dataset_version: config.dataset_version,
        decisions,
      });
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  };
  return {
    decisions,
    preview: isCurrent ? preview.value : null,
    error,
    previewError,
    submitting,
    updating: !isCurrent && !previewError,
    spent: totalCost(config, decisions),
    canSubmit:
      isCurrent && preview.value.complete && !submitting && !previewError,
    change,
    remove,
    submit,
    retryPreview: () => setRetry((n) => n + 1),
  };
}
