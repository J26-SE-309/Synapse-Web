"use client";



import { useRef, useState, type FormEvent } from "react";

import {

  analyzeRequirement,

  regenerateRequirement,

  type LexicalMeaningSelection,

  type AmbiguityReference,

  type RequirementAnalysis,

  type QualityLabel,

} from "../_lib/api";



const LABEL_STYLES: Record<QualityLabel, string> = {

  Good: "border-emerald-200 bg-emerald-50 text-emerald-800",

  Poor: "border-red-200 bg-red-50 text-red-800",

  "Needs Clarification": "border-amber-200 bg-amber-50 text-amber-800",

};



type LexicalItem = RequirementAnalysis["ambiguity"]["lexical_ambiguities"][number];



type ReferenceReplacement = {

  start: number;

  end: number;

  text: string;

  original: string;

};



type Resolution = { kind: "reference" | "lexical"; original: string; meaning: string };



function formatScore(score: number): string {

  return `${Math.round(score * 100)}%`;

}



function issueText(type: string, message: string, terms?: string[]): string {

  if (type === "missing_information") {

    const item = message.replace("Missing structural element: ", "").replace(/\.$/, "").trim();

    if (item.toLowerCase() === "requirement modal") {

      return "The sentence does not clearly say what someone or the system is required to do. State the expected action, for example by using 'shall' or 'must' where appropriate.";

    }

    return `The requirement does not clearly specify ${item || "some important information"}.`;

  }

  if (type === "vague_terms") {

    return terms?.length

      ? `The words ${terms.map((term) => `“${term}”`).join(", ")} may need a more precise explanation.`

      : "Some words could be understood in different ways.";

  }

  if (type === "quality_defect") {

    return "The quality checker identified a concern but did not provide a specific reason. Review the requirement and confirm whether any detail is missing.";

  }

  return message;

}



function issueTitle(type: string): string {

  if (type === "missing_information") return "Missing or unclear information";

  if (type === "vague_terms") return "Words that need clarification";

  return "Could be improved";

}



function qualityHeading(label: QualityLabel): string {

  if (label === "Good") return "✓ This requirement looks good";

  if (label === "Poor") return "⚠ This requirement needs clearer wording";

  return "⚠ This requirement needs more information";

}



function referenceRange(source: string, reference: AmbiguityReference): { start: number; end: number } | null {

  const word = reference.reference;

  const position = reference.position;

  if (

    Number.isInteger(position) &&

    position >= 0 &&

    source.slice(position, position + word.length).toLowerCase() === word.toLowerCase()

  ) {

    return { start: position, end: position + word.length };

  }

  const matches: number[] = [];

  const lowerSource = source.toLowerCase();

  const lowerWord = word.toLowerCase();

  let offset = 0;

  while (offset < source.length) {

    const found = lowerSource.indexOf(lowerWord, offset);

    if (found === -1) break;

    const before = found === 0 ? "" : source[found - 1];

    const after = source[found + word.length] ?? "";

    if (!/[\w]/.test(before) && !/[\w]/.test(after)) matches.push(found);

    offset = found + Math.max(word.length, 1);

  }

  return matches.length === 1 ? { start: matches[0], end: matches[0] + word.length } : null;

}



function lexicalRange(source: string, item: LexicalItem): { start: number; end: number } | null {

  const { start, end } = item.span;

  if (

    Number.isInteger(start) &&

    Number.isInteger(end) &&

    start >= 0 &&

    end <= source.length &&

    end > start &&

    source.slice(start, end).toLowerCase() === item.term.toLowerCase()

  ) {

    return { start, end };

  }

  return null;

}



/** Apply reference choices exactly as before, while tracking shifted lexical offsets. */

function buildReferenceRewrite(

  source: string,

  references: AmbiguityReference[],

  referenceChoices: Record<number, string>,

  lexicalChoices: LexicalMeaningSelection[],

): {

  text: string;

  choices: LexicalMeaningSelection[];

  notes: string[];

  resolved: Resolution[];

} {

  const replacements: ReferenceReplacement[] = [];

  const notes: string[] = [];

  references.forEach((reference, index) => {

    const choice = referenceChoices[index]?.trim();

    if (!choice) return;

    const range = referenceRange(source, reference);

    if (!range) {

      notes.push(`Could not safely locate “${reference.reference}”. Please edit it manually.`);

      return;

    }

    replacements.push({ ...range, text: choice, original: reference.reference });

  });



  // Do not apply overlapping reference replacements or replace a chosen lexical word.

  replacements.sort((a, b) => a.start - b.start || a.end - b.end);

  const accepted: ReferenceReplacement[] = [];

  for (const replacement of replacements) {

    if (

      (accepted.length > 0 && replacement.start < accepted[accepted.length - 1].end) ||

      lexicalChoices.some((choice) => replacement.start < choice.end && choice.start < replacement.end)

    ) {

      notes.push(`Overlapping selection near “${replacement.original}” was skipped. Review the draft.`);

      continue;

    }

    accepted.push(replacement);

  }



  let output = source;

  for (const replacement of [...accepted].reverse()) {

    output = output.slice(0, replacement.start) + replacement.text + output.slice(replacement.end);

  }

  const choices = lexicalChoices.map((choice) => {

    const shift = accepted

      .filter((replacement) => replacement.end <= choice.start)

      .reduce((total, replacement) => total + replacement.text.length - (replacement.end - replacement.start), 0);

    return { ...choice, start: choice.start + shift, end: choice.end + shift };

  });

  return {

    text: output,

    choices,

    notes,

    resolved: accepted.map((replacement) => ({

      kind: "reference" as const,

      original: replacement.original,

      meaning: replacement.text,

    })),

  };

}



export function RequirementQualityAnalyzer() {

  const requestId = useRef(0);
  const [text, setText] = useState("");

  const [analyzedText, setAnalyzedText] = useState("");

  const [result, setResult] = useState<RequirementAnalysis | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [isRegenerating, setIsRegenerating] = useState(false);

  const [regenerationError, setRegenerationError] = useState<string | null>(null);

  const [referenceChoices, setReferenceChoices] = useState<Record<number, string>>({});

  const [lexicalChoices, setLexicalChoices] = useState<Record<string, string>>({});

  type ContextualSuggestion = { suggested_sense: string | null; is_ambiguous: boolean; reason: string };
  const [lexicalSuggestions, setLexicalSuggestions] = useState<Record<string, ContextualSuggestion>>({});

  const [suggestionLoading, setSuggestionLoading] = useState(false);

  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const [customLexicalMeanings, setCustomLexicalMeanings] = useState<Record<string, string>>({});

  const [rewritten, setRewritten] = useState<string | null>(null);

  const [rewriteNotes, setRewriteNotes] = useState<string[]>([]);

  const [resolved, setResolved] = useState<Resolution[]>([]);

  const [pendingResolved, setPendingResolved] = useState<Resolution[]>([]);



  async function handleSubmit(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    const requirement = text.trim();

    if (!requirement) {

      setError("Please enter a requirement before analyzing it.");

      setResult(null);

      return;

    }

    const currentRequest = ++requestId.current;
    setIsAnalyzing(true);

    setError(null);

    try {

      const analysis = await analyzeRequirement({ requirement_id: `REQ-${Date.now()}`, text: requirement });

      setResult(analysis);

      setAnalyzedText(requirement);

      setReferenceChoices({});

      setLexicalChoices({});

      setLexicalSuggestions({});

      setCustomLexicalMeanings({});

      setSuggestionError(null);

      setSuggestionLoading(true);

      void fetch("http://127.0.0.1:8001/api/v1/lexical/suggest", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ text: requirement }),

      })

        .then(async (response) => {

          if (!response.ok) throw new Error(`Suggestion request failed (${response.status}).`);

          return response.json() as Promise<{ suggestions: Array<{ term: string; start: number; end: number; suggested_sense: string | null; is_ambiguous: boolean; reason: string }> }>;

        })

        .then((data) => {

          const next: Record<string, ContextualSuggestion> = {};

          for (const suggestion of data.suggestions) next[`${suggestion.start}-${suggestion.end}`] = { suggested_sense: suggestion.suggested_sense, is_ambiguous: suggestion.is_ambiguous, reason: suggestion.reason };

          setLexicalSuggestions(next);

        })

        .catch((cause: unknown) => { if (currentRequest === requestId.current) setSuggestionError(cause instanceof Error ? cause.message : "Could not load AI suggestions."); })

        .finally(() => { if (currentRequest === requestId.current) setSuggestionLoading(false); });

      setRewritten(null);

      setRewriteNotes([]);

      setRegenerationError(null);

      setResolved(pendingResolved);

      setPendingResolved([]);

    } catch (requestError) {

      setError(requestError instanceof Error ? requestError.message : "Unable to analyze the requirement.");

    } finally {

      setIsAnalyzing(false);

    }

  }



  const references = result?.ambiguity.references ?? [];

  const allLexicalItems: LexicalItem[] = result?.ambiguity.lexical_ambiguities ?? [];
  // Until the contextual response arrives (or if it fails), retain the original candidates.
  // Once it arrives, display only occurrences genuinely ambiguous in context.
  const lexicalItems = allLexicalItems.filter((item) => {
    const suggestion = lexicalSuggestions[`${item.span.start}-${item.span.end}`];
    return suggestionLoading ? false : suggestion === undefined || suggestion.is_ambiguous;
  });

  const flaggedCount = references.filter((reference) => reference.is_ambiguous).length;

  const selectedReferences = Object.values(referenceChoices).filter((choice) => choice.trim()).length;

  const selectedLexical = lexicalItems.filter((item) => {

    const key = `${item.span.start}-${item.span.end}`;

    return item.candidate_senses.some((sense) => sense.sense === lexicalChoices[key]) || (lexicalChoices[key] === "__custom__" && !!customLexicalMeanings[key]?.trim());

  }).length;

  const selectedCount = selectedReferences + selectedLexical;



  async function generateRewrite() {

    if (isRegenerating) return;

    setRegenerationError(null);

    setIsRegenerating(true);

    setRewritten(null);

    setRewriteNotes([]);

    setResolved([]);

    try {

      const selected: LexicalMeaningSelection[] = lexicalItems.flatMap((item) => {

        const key = `${item.span.start}-${item.span.end}`;

        const keyChoice = lexicalChoices[key];

        const sense = item.candidate_senses.find((candidate) => candidate.sense === keyChoice);

        const definition = keyChoice === "__custom__" ? customLexicalMeanings[key]?.trim() : sense?.definition;

        const range = lexicalRange(analyzedText, item);

        if (!definition || !range) return [];

        return [{ term: analyzedText.slice(range.start, range.end), ...range, definition }];

      });

      const draft = buildReferenceRewrite(analyzedText, references, referenceChoices, selected);

      const regenerated = draft.choices.length > 0

        ? (await regenerateRequirement({ text: draft.text, lexical_choices: draft.choices })).regenerated_text

        : draft.text;

      setRewritten(regenerated);

      setRewriteNotes(draft.notes);

      setResolved([

        ...draft.resolved,

        ...selected.map((choice) => ({

          kind: "lexical" as const,

          original: choice.term,

          meaning: choice.definition,

        })),

      ]);

    } catch (requestError) {

      setRegenerationError(requestError instanceof Error ? requestError.message : "Unable to regenerate the requirement.");

    } finally {

      setIsRegenerating(false);

    }

  }



  return (

    <div className="space-y-6">

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>

            <label htmlFor="requirement-text" className="block text-sm font-semibold text-zinc-900">Requirement</label>

            <p className="mt-1 text-sm text-zinc-500">Enter a software requirement to check its quality and clarity.</p>

          </div>

          <textarea

            id="requirement-text"

            value={text}

            onChange={(event) => setText(event.target.value)}

            rows={5}

            disabled={isAnalyzing}

            placeholder="Example: The system shall support light devices."

            className="w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"

          />

          <div className="flex flex-wrap items-center justify-between gap-3">

            <p className="text-xs text-zinc-500">Check what is missing and choose the meanings you intended.</p>

            <button type="submit" disabled={isAnalyzing} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:bg-zinc-400">

              {isAnalyzing ? "Analyzing..." : "Analyze requirement"}

            </button>

          </div>

        </form>

      </section>



      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}



      {result && (

        <>

          <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">

            <div className="border-b border-zinc-200 pb-3">

              <h2 className="text-xl font-semibold text-zinc-900">1. Quality analysis</h2>

              <p className="mt-1 text-sm text-zinc-500">Does the requirement clearly state what is expected?</p>

            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">

              <h3 className="text-lg font-semibold text-zinc-900">{qualityHeading(result.quality.label)}</h3>

              <div className="flex flex-wrap items-center gap-3">

                <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${LABEL_STYLES[result.quality.label]}`}>{result.quality.label}</span>

                <span className="text-sm text-zinc-700">Score: <strong>{formatScore(result.quality.score)}</strong></span>

              </div>

            </div>

            <p className="rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">

              {result.quality.issues.some((issue) => issue.type === "missing_information" && issue.message.toLowerCase().includes("requirement modal"))

                ? "The requirement does not clearly state what must happen. It may describe something that already happened instead of stating an expected action."

                : result.explanation}

            </p>

            {result.quality.issues.length > 0 && (

              <div>

                <h3 className="text-sm font-semibold text-zinc-900">What needs improvement</h3>

                <ul className="mt-3 space-y-3">

                  {result.quality.issues.map((issue, index) => (

                    <li key={`${issue.type}-${index}`} className="rounded-md bg-zinc-50 p-3">

                      <p className="text-sm font-semibold text-zinc-900">{issueTitle(issue.type)}</p>

                      <p className="mt-1 text-sm leading-6 text-zinc-700">{issueText(issue.type, issue.message, issue.terms)}</p>

                    </li>

                  ))}

                </ul>

              </div>

            )}

          </section>



          <section className="space-y-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">

            <div className="border-b border-zinc-200 pb-3">

              <h2 className="text-xl font-semibold text-zinc-900">2. Ambiguity analysis</h2>

              <p className="mt-1 text-sm text-zinc-500">Choose the intended reference or word meaning to clarify the requirement.</p>

            </div>



            <div className="space-y-3">

              <h3 className="text-base font-semibold text-zinc-900">Referential ambiguity</h3>

              <div className={`rounded-md border p-3 ${flaggedCount ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>

                <p className={`text-sm font-semibold ${flaggedCount ? "text-amber-900" : "text-emerald-900"}`}>

                  {flaggedCount ? `⚠ ${flaggedCount} ${flaggedCount === 1 ? "reference may be unclear" : "references may be unclear"}` : "✓ No unclear references were flagged"}

                </p>

                <p className="mt-1 text-sm text-zinc-700">More than one possible referent does not necessarily mean a reference is unclear.</p>

              </div>

              {references.length === 0 && <p className="text-sm text-zinc-600">No references were found for selection.</p>}

              {references.map((reference, index) => {

                const options = Array.from(new Set([

                  ...(reference.best_candidate ? [reference.best_candidate] : []),

                  ...reference.candidate_interpretations.map((candidate) => candidate.candidate),

                ].filter(Boolean)));

                return (

                  <div key={`${reference.reference}-${reference.position}-${index}`} className="rounded-lg border border-zinc-200 p-4">

                    <div className="flex flex-wrap items-center justify-between gap-2">

                      <p className="font-semibold text-zinc-900">“{reference.reference}”</p>

                      {reference.is_ambiguous && <span className="text-xs font-medium text-amber-800">Please review</span>}

                    </div>

                    <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">

                      <p className="text-xs font-medium text-zinc-500">Most likely meaning</p>

                      <p className="mt-1 text-sm font-semibold text-zinc-900">{reference.best_candidate || "No clear suggestion available"}</p>

                      <p className="mt-1 text-xs text-zinc-500">This is a suggestion. You can choose a different meaning below.</p>

                    </div>

                    <p className="mt-3 text-sm font-medium text-zinc-700">Choose the intended meaning</p>

                    <div className="mt-2 space-y-2">

                      {options.map((option) => (

                        <label key={option} className="flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 p-3 text-sm text-zinc-800 hover:bg-zinc-50">

                          <input

                            type="radio"

                            name={`reference-${index}`}

                            value={option}

                            checked={referenceChoices[index] === option}

                            onChange={() => { setReferenceChoices((prev) => ({ ...prev, [index]: option })); setRewritten(null); setResolved([]); }}

                            className="mt-0.5"

                          />

                          <span>{option} {option === reference.best_candidate && <span className="ml-1 text-xs font-medium text-emerald-700">(Suggested)</span>}</span>

                        </label>

                      ))}

                    </div>

                    <label className="mt-3 block text-sm font-medium text-zinc-700" htmlFor={`custom-reference-${index}`}>Or enter your own meaning</label>

                    <input

                      id={`custom-reference-${index}`}

                      value={referenceChoices[index] && !options.includes(referenceChoices[index]) ? referenceChoices[index] : ""}

                      onChange={(event) => {

                        const value = event.target.value;

                        setReferenceChoices((prev) => {

                          const next = { ...prev };

                          if (value) next[index] = value;

                          else delete next[index];

                          return next;

                        });

                        setRewritten(null);

                        setResolved([]);

                      }}

                      placeholder="Type what this word refers to"

                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"

                    />

                  </div>

                );

              })}

            </div>



              <div className="space-y-3 border-t border-zinc-200 pt-5">

                <h3 className="text-base font-semibold text-zinc-900">Lexical ambiguity</h3>

                <p className="text-sm leading-6 text-zinc-600">

                  Only contextually ambiguous words need clarification. Choose a meaning from the dropdown or type your own. AI suggestions are never automatically selected.

                </p>

                {suggestionLoading && <p className="text-sm text-zinc-500">Checking which words are genuinely ambiguous in context...</p>}

                {suggestionError && <p role="status" className="text-sm text-amber-700">Contextual ambiguity check unavailable: {suggestionError}. Showing WordNet candidates so you can review them manually.</p>}

                {!suggestionLoading && lexicalItems.length === 0 && <p className="text-sm text-zinc-600">No contextual lexical ambiguity detected.</p>}

                {lexicalItems.map((item) => {

                  const key = `${item.span.start}-${item.span.end}`;

                  const suggestedId = lexicalSuggestions[key]?.suggested_sense;

                  const suggested = item.candidate_senses.find((sense) => sense.sense === suggestedId);

                  const choice = lexicalChoices[key] ?? "";

                  return (

                    <div key={key} className="rounded-lg border border-zinc-200 p-4 space-y-3">

                      <p className="font-semibold text-zinc-900">“{item.term}”</p>

                      {suggested && (

                        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">

                          <p className="text-xs font-semibold text-emerald-800">AI-suggested meaning (not selected)</p>

                          <p className="mt-1 text-sm text-zinc-800">{suggested.definition}</p>

                        </div>

                      )}

                      {!suggestionLoading && Object.prototype.hasOwnProperty.call(lexicalSuggestions, key) && !suggested && (

                        <p className="text-xs text-zinc-500">No confident contextual suggestion. Please choose manually.</p>

                      )}

                      <label htmlFor={`lexical-${key}`} className="block text-sm font-medium text-zinc-700">Choose intended meaning</label>

                      <select

                        id={`lexical-${key}`}

                        value={choice}

                        onChange={(event) => {

                          setLexicalChoices((prev) => ({ ...prev, [key]: event.target.value }));

                          setRewritten(null);

                          setResolved([]);

                        }}

                        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"

                      >

                        <option value="">Select a meaning...</option>

                        <option value="__skip__">No clarification needed</option>

                        {item.candidate_senses.map((sense) => (

                          <option key={sense.sense} value={sense.sense}>

                            {sense.definition}{sense.sense === suggestedId ? " (AI suggested)" : ""}

                          </option>

                        ))}

                        <option value="__custom__">Other — type my own meaning</option>

                      </select>

                      <div>

                        <label htmlFor={`custom-lexical-${key}`} className="block text-sm font-medium text-zinc-700">Your own meaning (if none of the options fits)</label>

                        <textarea

                          id={`custom-lexical-${key}`}

                          rows={2}

                          value={customLexicalMeanings[key] ?? ""}

                          onChange={(event) => {

                            const value = event.target.value;

                            setCustomLexicalMeanings((prev) => ({ ...prev, [key]: value }));

                            if (value.trim()) setLexicalChoices((prev) => ({ ...prev, [key]: "__custom__" }));

                            setRewritten(null);

                            setResolved([]);

                          }}

                          placeholder={`Describe what “${item.term}” means in this requirement...`}

                          className="mt-1 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"

                        />

                        {choice === "__custom__" && !customLexicalMeanings[key]?.trim() && (

                          <p className="mt-1 text-xs text-amber-700">Enter your meaning to include this word in regeneration.</p>

                        )}

                      </div>

                      {choice && (

                        <button type="button" onClick={() => {

                          setLexicalChoices((prev) => { const next = { ...prev }; delete next[key]; return next; });

                          setCustomLexicalMeanings((prev) => { const next = { ...prev }; delete next[key]; return next; });

                          setRewritten(null);

                          setResolved([]);

                        }} className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-800">Clear selection</button>

                      )}

                    </div>

                  );

                })}

              </div>



            <div className="border-t border-zinc-200 pt-5">

              <h3 className="text-base font-semibold text-zinc-900">Regenerate using your selected meanings</h3>

              <p className="mt-1 text-sm leading-6 text-zinc-600">

                Reference choices replace reference words. Selected lexical meanings are sent together to Gemini to produce one natural requirement. Words marked “No clarification needed” are skipped.

              </p>

              <button

                type="button"

                disabled={selectedCount === 0 || isRegenerating}

                onClick={generateRewrite}

                className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"

              >

                {isRegenerating ? "Regenerating..." : `Regenerate requirement (${selectedCount} selected)`}

              </button>



              {regenerationError && <p role="alert" className="mt-3 text-sm text-red-700">{regenerationError}</p>}

              {rewritten !== null && (

                <div className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">

                  <label htmlFor="rewritten-requirement" className="block text-sm font-semibold text-zinc-900">Your rewritten requirement</label>

                  <textarea

                    id="rewritten-requirement"

                    value={rewritten}

                    onChange={(event) => setRewritten(event.target.value)}

                    rows={5}

                    className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"

                  />

                  {rewriteNotes.map((note, index) => <p key={index} className="text-sm text-amber-800">{note}</p>)}

                  <p className="text-xs leading-5 text-zinc-600">Review the grammar and accuracy. This draft is not a guaranteed ambiguity-free requirement.</p>

                  {resolved.length > 0 && (

                    <details className="rounded-md border border-zinc-200 bg-white p-3" open>

                      <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Resolved clarifications ({resolved.length})</summary>

                      <ul className="mt-2 space-y-2 text-sm text-zinc-700">

                        {resolved.map((item, index) => (

                          <li key={`${item.kind}-${index}`}>

                            <span className="font-medium">{item.original}</span> → {item.meaning}

                            <span className="ml-2 text-xs text-zinc-500">({item.kind})</span>

                          </li>

                        ))}

                      </ul>

                    </details>

                  )}

                  <button

                    type="button"

                    disabled={!rewritten.trim()}

                    onClick={() => {

                      setText(rewritten);

                      setPendingResolved(resolved);

                      setResult(null);

                      setRewritten(null);

                      window.scrollTo({ top: 0, behavior: "smooth" });

                    }}

                    className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"

                  >

                    Use this requirement and analyze again

                  </button>

                </div>

              )}

            </div>

          </section>



          {resolved.length > 0 && rewritten === null && (

            <details className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">

              <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Previous clarifications ({resolved.length})</summary>

              <ul className="mt-3 space-y-2 text-sm text-zinc-700">

                {resolved.map((item, index) => <li key={index}>{item.original} → {item.meaning}</li>)}

              </ul>

              <p className="mt-2 text-xs text-zinc-500">History only. A word may reappear only if the new contextual check still finds plausible competing meanings.</p>

            </details>

          )}

        </>

      )}

    </div>

  );

}
