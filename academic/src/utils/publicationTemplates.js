// Shared by rendering and config validation so template requirements stay aligned.
const narrativeFields = ["takeaway", "intro", "headline", "method", "figure", "figureCaption", "steps"];
const resultFields = ["highlight", "highlightLabel", "highlightContext", "resultTitle", "resultNote", "rows", "source", "sourceLabel", "footnote"];
export const publicationTemplates = {
  basic: { className: "basic", required: [] },
  narrative: { className: "narrative", required: narrativeFields },
  comparison: { className: "dpc-vqa", required: [...narrativeFields, ...resultFields] },
  budget: { className: "leaf", required: [...narrativeFields, ...resultFields, "ablationRows"] },
  challenge: { className: "vquala", required: [...narrativeFields, ...resultFields, "ablationRows"] },
};

export function getPublicationTemplate(story = {}) {
  return story.template ?? story.layout ?? "basic";
}

export function resolvePublicationPreview(paper, config = {}) {
  const template = getPublicationTemplate(config);
  return {
    name: paper.title, source: paper.link, steps: [],
    ...config,
    template,
    abstractExpanded: config.abstractExpanded ?? template === "basic",
    blendFigureBackground: config.blendFigureBackground ?? true,
    labels: {
      idea: "The idea", method: "Inside the method", results: "Evidence",
      abstract: "Original abstract", entry: "Team entry",
      reference: "Few-shot reference", ranking: "Final leaderboard",
      groups: "View results by image group", groupTitle: "Image groups",
      ...config.labels,
    },
  };
}
