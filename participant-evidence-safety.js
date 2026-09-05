/* Partner-facing participant-evidence quarantine (classic script). */
(function (root) {
  "use strict";

  var REMOVED = "[Instruction-like content removed from report evidence.]";
  var CONVERSATIONAL = /^(?:please\s+)?(?:walk|tell|explain|give|reveal|repeat|break\s+down|derive|reproduce|reconstruct|calculate|compute|provide|help\s+me|ignore|disregard|override|forget|bypass|classify|treat|assume|describe|depict|portray|declare|characterize)\b|^(?:please\s+)?(?:show|list|print|quote|map|return|make|report|mark|frame|label|call|present)\s+(?:this|it|that|the|a|an|all|every|each|my|your)\b|^(?:for\s+this\s+(?:report|result|diagnostic)\b)|^(?:can|could|would|will|may|might|should)\s+(?:you|we|i)\b/i;
  var INSTRUCTION_PATTERNS = [
    /\b(?:ignore|disregard|override|forget|bypass)\b[^.!?]{0,100}\b(?:instruction|prompt|system|developer|assistant|constraint)s?\b/i,
    /\b(?:system|developer|assistant)\s+(?:message|prompt|instruction|role)\b/i,
    /\b(?:reveal|show|print|list|expose|extract|reconstruct|explain|provide|return)\b[^.!?]{0,120}\b(?:prompt|source\s+code|scoring\s+(?:formula|method|weight)|weights?|coefficients?|thresholds?|question\s+bank|hidden\s+dimensions?|subscales?|api\s+key|secret|token|environment\s+variable)s?\b/i,
    /\b(?:set|change|raise|lower|force|replace|override)\b[^.!?]{0,80}\b(?:score|band|result|benchmark|exposure|annual\s+(?:hours|cost)|capacity\s+drag)\b/i,
    /\b(?:invent|fabricate|make\s+up|pretend|claim|state|say)\b[^.!?]{0,100}\b(?:fact|event|person|name|cause|saving|result|evidence|finding)s?\b/i,
    /\b(?:respond|output|return|emit)\b[^.!?]{0,80}\b(?:json|html|javascript|script|markdown|xml|exact(?:ly)?|only)\b/i,
    /<\/?(?:script|system|assistant|developer|tool)\b|```|\{\{[^}]+\}\}/i
  ];
  var INPUT_TERM = /\b(?:answers?|responses?|choices?|selections?|options?|items?|questions?)\b/i;
  var OUTPUT_TERM = /\b(?:scores?|ratings?|results?|outcomes?|numbers?|values?|totals?|tall(?:y|ies)|bands?|categories?|classifications?|statuses|contributions?|consequences?|points?|units?)\b/i;
  var RELATION_TERM = /\b(?:map(?:ping|ped)?|crosswalk|correspondence|keys?|translat(?:e|es|ed|ing|ion)|connect(?:s|ed|ing)?|pair(?:s|ed|ing)?|convert(?:s|ed|ing)?|conversion|effect|impact|contribut(?:e|es|ed|ing|ion)|consequence|worth|assign(?:s|ed|ing|ment)?|deposit(?:s|ed|ing)?|produc(?:e|es|ed|ing)|yield(?:s|ed|ing)?|add(?:s|ed|ing)?|subtract(?:s|ed|ing)?|mov(?:e|es|ed|ing)|chang(?:e|es|ed|ing)|alter(?:s|ed|ing)?|numerical)\b/i;
  var LENS_TERM = /\b(?:lens(?:es)?|diagnostics?)\b/i;
  var AGGREGATE_TERM = /\b(?:aggregate|composite|combined|synthesis)\b/i;
  var AGGREGATE_RELATION = /\b(?:blend(?:s|ed|ing)?|averag(?:e|es|ed|ing)|mean|sum(?:s|med|ming)?|total(?:s|ed|ing)?|equal(?:ly)?|even(?:ly)?|identical|weigh(?:s|ed|ing|ts?)|coefficients?|eligib(?:le|ility)|qualif(?:y|ies|ied|ication)|releas(?:e|es|ed|ing)|availab(?:le|ility)|requir(?:e|es|ed|ing)|minimum|enough|sufficient)\b/i;
  var BOUNDARY_SUBJECT = /\b(?:bands?|categories?|ratings?|labels?|classifications?|status(?:es)?|mixed|workable)\b/i;
  var BOUNDARY_RELATION = /\b(?:divid(?:e|es|ed|ing)|line|threshold|cutoff|boundary|breakpoint|advanc(?:e|es|ed|ing)|switch(?:es|ed|ing)?|begins?|starts?|changes?|moves?|at|above|below|after|once)\b/i;
  var QUANTITY = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th)?|\d+(?:\.\d+)?%?)\b/i;
  var ELIGIBILITY_TERM = /\b(?:eligib(?:le|ility)|qualif(?:y|ies|ied|ication)|minimum|required?|enough|sufficient|available|released?)\b/i;
  var EVIDENCE_UNIT = /\b(?:readings?|runs?|observations?|responses?|samples?|participants?)\b/i;

  function clean(value, limit) {
    return String(value == null ? "" : value)
      .replace(/<[^>]*>/g, " ")
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limit || 1600);
  }

  function protectedSemantics(text) {
    return (INPUT_TERM.test(text) && OUTPUT_TERM.test(text) && RELATION_TERM.test(text))
      || (LENS_TERM.test(text) && AGGREGATE_TERM.test(text) && AGGREGATE_RELATION.test(text))
      || (LENS_TERM.test(text) && ELIGIBILITY_TERM.test(text) && EVIDENCE_UNIT.test(text) && QUANTITY.test(text))
      || (BOUNDARY_SUBJECT.test(text) && BOUNDARY_RELATION.test(text) && (QUANTITY.test(text) || /\bunits?\b/i.test(text)));
  }

  function unsafeSegment(segment) {
    return CONVERSATIONAL.test(segment)
      || protectedSemantics(segment)
      || INSTRUCTION_PATTERNS.some(function (pattern) { return pattern.test(segment); });
  }

  function sanitizeText(value, limit) {
    var source = clean(value, Math.max((limit || 1600) * 4, 6400));
    if (!source) return { text: "", redactedCount: 0 };
    var redactedCount = 0;
    var segments = source.split(/(?<=[.!?;])\s+|\n+/).map(function (segment) { return segment.trim(); }).filter(Boolean);
    var safe = segments.filter(function (segment) {
      if (unsafeSegment(segment)) { redactedCount += 1; return false; }
      return true;
    });
    return { text: clean(safe.join(" "), limit || 1600), redactedCount: redactedCount };
  }

  function safeCandidate(entry) {
    var candidates = [entry && entry.cleaned, entry && entry.text, entry && entry.summary, entry && entry.message, entry && entry.raw];
    for (var i = 0; i < candidates.length; i += 1) {
      var screened = sanitizeText(candidates[i], 1600);
      if (screened.text) return screened;
    }
    return { text: "", redactedCount: candidates.some(Boolean) ? 1 : 0 };
  }

  function sanitizeEntry(entry) {
    if (typeof entry === "string") entry = { text: entry };
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    var screened = safeCandidate(entry);
    if (!screened.text) return null;
    return {
      key: clean(entry.key, 80),
      label: clean(entry.label, 160),
      vantage: clean(entry.vantage || entry.participant_mode || entry.perspective, 80),
      participant_mode: clean(entry.participant_mode || entry.vantage || entry.perspective, 80),
      evidence_type: clean(entry.evidence_type, 80),
      source_field: clean(entry.source_field, 80),
      score_effect: "none",
      cleaned: screened.text,
      text: screened.text
    };
  }

  function sanitizeLayer(layer) {
    layer = layer && typeof layer === "object" && !Array.isArray(layer) ? layer : {};
    var entries = (Array.isArray(layer.entries) ? layer.entries : []).map(sanitizeEntry).filter(Boolean).slice(0, 12);
    var synthesis = sanitizeText(layer.synthesis, 1400).text;
    var caveat = sanitizeText(layer.caveat, 900).text;
    return {
      participantPerspective: clean(layer.participantPerspective || layer.participant_perspective, 120),
      entries: entries,
      hasInput: entries.length > 0,
      synthesis: synthesis || (entries.length ? "Participant observations are shown as attributed, interpretive context and do not affect the quantitative score." : "No usable participant notes are presented in this report."),
      caveat: caveat || "Participant observations should be compared across roles before they are treated as an organizational pattern.",
      source: "deterministic_report_quarantine"
    };
  }

  function sanitizeEvidenceArray(value) {
    return (Array.isArray(value) ? value : []).map(sanitizeEntry).filter(Boolean).slice(0, 12);
  }

  root.MondermanParticipantEvidence = {
    removedMarker: REMOVED,
    sanitizeText: sanitizeText,
    sanitizeLayer: sanitizeLayer,
    sanitizeEvidenceArray: sanitizeEvidenceArray
  };
})(typeof window !== "undefined" ? window : globalThis);
