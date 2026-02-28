(* WA grounding diagnostic graph artifact *)
(* Expects wa_graph_nodes.json and wa_graph_edges.json in the current directory *)
nodes = Import["wa_graph_nodes.json", "RawJSON"];
edges = Import["wa_graph_edges.json", "RawJSON"];

statusColors = <|
  "accepted" -> RGBColor[0.086, 0.627, 0.306],
  "metadata_only" -> RGBColor[0.855, 0.576, 0.106],
  "rejected_category_mismatch" -> RGBColor[0.863, 0.078, 0.235],
  "rejected_low_confidence" -> RGBColor[0.522, 0.447, 0.702],
  "no_plaintext" -> RGBColor[0.278, 0.565, 0.761]
|>;

vertexLabels = Association @ Map[#["id"] -> Row[{#["kind"], ": ", #["label"]}] &, nodes];
vertexStyles = Association @ Map[
  If[StringLength @ ToString @ Lookup[#, "statusBucket", ""] > 0,
    #["id"] -> Lookup[statusColors, Lookup[#, "statusBucket", ""], GrayLevel[0.45]],
    Nothing
  ] &,
  nodes
];

edgeRules = Map[#["source"] -> #["target"] &, edges];
edgeWeights = Map[Max[1, Lookup[#, "weight", 1]] &, edges];
edgeStyles = Map[
  (#["source"] -> #["target"]) -> Directive[
    Lookup[statusColors, Lookup[#, "dominantStatusBucket", ""], GrayLevel[0.6]],
    Opacity[0.55]
  ] &,
  edges
];

Graph[
  edgeRules,
  VertexLabels -> (v_ :> Lookup[vertexLabels, v, v]),
  VertexStyle -> vertexStyles,
  EdgeWeight -> edgeWeights,
  EdgeStyle -> edgeStyles,
  GraphLayout -> "LayeredDigraphEmbedding",
  ImageSize -> Large
]