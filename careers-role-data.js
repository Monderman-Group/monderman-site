/* Shared future-role identifiers; these are not active job postings. */
(function (root, factory) {
  var data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.MondermanCareerRoles = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var data = {
  "roles": [
    {
      "id": "product-engineer-1",
      "title": "Product Engineer (position 1)",
      "group": "product",
      "responsibility": "Build diagnostic, reporting and Workspace workflows.",
      "skills": "JavaScript or TypeScript; web applications; SQL; testing.",
      "slot": 1
    },
    {
      "id": "product-engineer-2",
      "title": "Product Engineer (position 2)",
      "group": "product",
      "responsibility": "Develop and maintain the same product workflows as capacity grows.",
      "skills": "Full-stack development; debugging; accessible interfaces.",
      "slot": 2
    },
    {
      "id": "frontend-engineer",
      "title": "Frontend Engineer",
      "group": "product",
      "responsibility": "Make complex diagnostic screens clear, responsive and accessible.",
      "skills": "HTML and CSS; JavaScript; accessibility; browser performance.",
      "slot": 3
    },
    {
      "id": "platform-reliability-engineer",
      "title": "Platform & Reliability Engineer",
      "group": "product",
      "responsibility": "Improve deployment, observability, recovery and service reliability.",
      "skills": "Cloud operations; automation; monitoring; incident diagnosis.",
      "slot": 4
    },
    {
      "id": "quality-engineer",
      "title": "Quality Engineer",
      "group": "product",
      "responsibility": "Protect diagnostic calculations, reports, PDFs and user journeys.",
      "skills": "Test design; browser automation; regression analysis; reproducibility.",
      "slot": 5
    },
    {
      "id": "product-designer",
      "title": "Product Designer",
      "group": "product",
      "responsibility": "Turn organizational evidence into understandable product experiences.",
      "skills": "Interaction design; usability research; information design; plain language.",
      "slot": 6
    },
    {
      "id": "security-engineer",
      "title": "Security Engineer",
      "group": "product",
      "responsibility": "Strengthen application security and responsible data handling.",
      "skills": "Web security; authorization; threat modeling; secure development.",
      "slot": 7
    },
    {
      "id": "organizational-research-lead",
      "title": "Organizational Research Lead",
      "group": "research",
      "responsibility": "Guide research questions and connect organizational concepts to diagnostic work.",
      "skills": "Organizational research; mixed methods; study design; clear writing.",
      "slot": 8
    },
    {
      "id": "measurement-scientist",
      "title": "Measurement Scientist",
      "group": "research",
      "responsibility": "Evaluate measures, consistency, interpretation and methodological limits.",
      "skills": "Statistics; measurement; reproducible analysis; technical communication.",
      "slot": 9
    },
    {
      "id": "research-analyst-1",
      "title": "Research Analyst (position 1)",
      "group": "research",
      "responsibility": "Review evidence, analyze structured data and prepare research findings.",
      "skills": "Literature review; quantitative analysis; source checking; writing.",
      "slot": 10
    },
    {
      "id": "research-analyst-2",
      "title": "Research Analyst (position 2)",
      "group": "research",
      "responsibility": "Support research across additional organizational settings.",
      "skills": "Data analysis; qualitative synthesis; documentation; evidence appraisal.",
      "slot": 11
    },
    {
      "id": "implementation-consultant-1",
      "title": "Implementation Consultant (position 1)",
      "group": "delivery",
      "responsibility": "Help organizations define scope, gather perspectives and interpret findings.",
      "skills": "Facilitation; organizational analysis; project coordination; communication.",
      "slot": 12
    },
    {
      "id": "implementation-consultant-2",
      "title": "Implementation Consultant (position 2)",
      "group": "delivery",
      "responsibility": "Support additional implementations and translate findings into practical next steps.",
      "skills": "Implementation planning; stakeholder coordination; report interpretation.",
      "slot": 13
    },
    {
      "id": "customer-success-manager",
      "title": "Customer Success Manager",
      "group": "delivery",
      "responsibility": "Help customers establish useful working practices and communicate product feedback.",
      "skills": "Onboarding; account coordination; adoption planning; listening.",
      "slot": 14
    },
    {
      "id": "solutions-engineer",
      "title": "Solutions Engineer",
      "group": "delivery",
      "responsibility": "Explain product fit and translate organizational requirements into feasible solutions.",
      "skills": "Product demonstrations; technical discovery; integration analysis; documentation.",
      "slot": 15
    },
    {
      "id": "support-documentation-specialist",
      "title": "Support & Documentation Specialist",
      "group": "delivery",
      "responsibility": "Resolve product questions and maintain clear help materials.",
      "skills": "Troubleshooting; technical writing; issue reproduction; customer communication.",
      "slot": 16
    },
    {
      "id": "content-research-communications-specialist",
      "title": "Content & Research Communications Specialist",
      "group": "operations",
      "responsibility": "Explain Monderman’s methods, findings and potential ROI accurately.",
      "skills": "Research editing; B2B writing; evidence checking; content planning.",
      "slot": 17
    },
    {
      "id": "consultant-partnerships-manager",
      "title": "Consultant Partnerships Manager",
      "group": "operations",
      "responsibility": "Develop relationships and useful enablement materials for consulting partners.",
      "skills": "Partnership development; facilitation; training; commercial coordination.",
      "slot": 18
    },
    {
      "id": "business-development-manager",
      "title": "Business Development Manager",
      "group": "operations",
      "responsibility": "Understand prospective customers’ needs and assess genuine product fit.",
      "skills": "Discovery conversations; SaaS sales; business cases; clear communication.",
      "slot": 19
    },
    {
      "id": "business-operations-generalist",
      "title": "Business Operations Generalist",
      "group": "operations",
      "responsibility": "Coordinate internal processes, suppliers, records and operational priorities.",
      "skills": "Operations; budgeting support; process documentation; organization.",
      "slot": 20
    }
  ],
  "groups": [
    {
      "id": "product",
      "title": "Product & Engineering"
    },
    {
      "id": "research",
      "title": "Research & Diagnostics"
    },
    {
      "id": "delivery",
      "title": "Customer Delivery"
    },
    {
      "id": "operations",
      "title": "Commercial & Operations"
    }
  ],
  "workStates": [
    {
      "code": "AL",
      "name": "Alabama"
    },
    {
      "code": "AK",
      "name": "Alaska"
    },
    {
      "code": "AZ",
      "name": "Arizona"
    },
    {
      "code": "AR",
      "name": "Arkansas"
    },
    {
      "code": "CA",
      "name": "California"
    },
    {
      "code": "CO",
      "name": "Colorado"
    },
    {
      "code": "CT",
      "name": "Connecticut"
    },
    {
      "code": "DE",
      "name": "Delaware"
    },
    {
      "code": "DC",
      "name": "District of Columbia"
    },
    {
      "code": "FL",
      "name": "Florida"
    },
    {
      "code": "GA",
      "name": "Georgia"
    },
    {
      "code": "HI",
      "name": "Hawaii"
    },
    {
      "code": "ID",
      "name": "Idaho"
    },
    {
      "code": "IL",
      "name": "Illinois"
    },
    {
      "code": "IN",
      "name": "Indiana"
    },
    {
      "code": "IA",
      "name": "Iowa"
    },
    {
      "code": "KS",
      "name": "Kansas"
    },
    {
      "code": "KY",
      "name": "Kentucky"
    },
    {
      "code": "LA",
      "name": "Louisiana"
    },
    {
      "code": "ME",
      "name": "Maine"
    },
    {
      "code": "MD",
      "name": "Maryland"
    },
    {
      "code": "MA",
      "name": "Massachusetts"
    },
    {
      "code": "MI",
      "name": "Michigan"
    },
    {
      "code": "MN",
      "name": "Minnesota"
    },
    {
      "code": "MS",
      "name": "Mississippi"
    },
    {
      "code": "MO",
      "name": "Missouri"
    },
    {
      "code": "MT",
      "name": "Montana"
    },
    {
      "code": "NE",
      "name": "Nebraska"
    },
    {
      "code": "NV",
      "name": "Nevada"
    },
    {
      "code": "NH",
      "name": "New Hampshire"
    },
    {
      "code": "NJ",
      "name": "New Jersey"
    },
    {
      "code": "NM",
      "name": "New Mexico"
    },
    {
      "code": "NY",
      "name": "New York"
    },
    {
      "code": "NC",
      "name": "North Carolina"
    },
    {
      "code": "ND",
      "name": "North Dakota"
    },
    {
      "code": "OH",
      "name": "Ohio"
    },
    {
      "code": "OK",
      "name": "Oklahoma"
    },
    {
      "code": "OR",
      "name": "Oregon"
    },
    {
      "code": "PA",
      "name": "Pennsylvania"
    },
    {
      "code": "RI",
      "name": "Rhode Island"
    },
    {
      "code": "SC",
      "name": "South Carolina"
    },
    {
      "code": "SD",
      "name": "South Dakota"
    },
    {
      "code": "TN",
      "name": "Tennessee"
    },
    {
      "code": "TX",
      "name": "Texas"
    },
    {
      "code": "UT",
      "name": "Utah"
    },
    {
      "code": "VT",
      "name": "Vermont"
    },
    {
      "code": "VA",
      "name": "Virginia"
    },
    {
      "code": "WA",
      "name": "Washington"
    },
    {
      "code": "WV",
      "name": "West Virginia"
    },
    {
      "code": "WI",
      "name": "Wisconsin"
    },
    {
      "code": "WY",
      "name": "Wyoming"
    }
  ]
};
  [data.roles, data.groups, data.workStates].forEach(function (rows) { rows.forEach(Object.freeze); Object.freeze(rows); });
  return Object.freeze(data);
});
