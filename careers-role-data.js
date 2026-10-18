/* Shared position identifiers and job descriptions. */
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
      "slot": 1,
      "description": "Help build the core workflows that turn organizational perspectives into useful evidence. This position focuses on diagnostic participation, reporting and the Workspace experience, making each step dependable and understandable for the people using it.",
      "responsibilities": [
        "Build and maintain features across diagnostic, reporting and Workspace workflows.",
        "Connect browser interfaces, application services and SQL-backed records with clear data contracts.",
        "Write tests for calculations, permissions, error states and complete user journeys.",
        "Investigate defects, document decisions and collaborate on product improvements."
      ],
      "qualifications": [
        "Practical experience building web applications with JavaScript or TypeScript and working with SQL.",
        "Ability to explain implementation choices, review code and trace problems across an application.",
        "A careful approach to accessible interfaces, data protection and maintainable tests."
      ]
    },
    {
      "id": "product-engineer-2",
      "title": "Product Engineer (position 2)",
      "group": "product",
      "responsibility": "Develop and maintain the same product workflows as capacity grows.",
      "skills": "Full-stack development; debugging; accessible interfaces.",
      "slot": 2,
      "description": "Help develop and maintain the workflows that organizations use to understand how their work gets done. This position contributes across the application, with particular attention to reliable data handling and improvements that make existing features easier to use and support.",
      "responsibilities": [
        "Develop features across web interfaces, application services and reporting flows.",
        "Improve validation, error handling and data movement between parts of the platform.",
        "Reproduce reported problems and deliver changes with meaningful regression coverage.",
        "Document interfaces and contribute to code reviews, releases and product improvements."
      ],
      "qualifications": [
        "Experience delivering and maintaining full-stack web applications.",
        "Ability to debug unfamiliar code and reason about asynchronous requests and stored data.",
        "Clear communication and attention to accessibility, security and supportability."
      ]
    },
    {
      "id": "frontend-engineer",
      "title": "Frontend Engineer",
      "group": "product",
      "responsibility": "Make complex diagnostic screens clear, responsive and accessible.",
      "skills": "HTML and CSS; JavaScript; accessibility; browser performance.",
      "slot": 3,
      "description": "Make organizational diagnostics clear and usable on the screens where people encounter them. This position translates product and research requirements into accessible interfaces, including participation flows, evidence displays and reports that work across browsers and device sizes.",
      "responsibilities": [
        "Build responsive interfaces with semantic HTML, CSS and JavaScript.",
        "Make forms, navigation, tables and results usable with keyboards and assistive technology.",
        "Investigate browser differences, layout defects and performance problems.",
        "Collaborate on interface design and maintain useful regression tests."
      ],
      "qualifications": [
        "Practical experience building and maintaining browser-based applications.",
        "Working knowledge of accessible interaction patterns, responsive layouts and browser developer tools.",
        "Ability to turn complex information into clear interfaces and explain technical tradeoffs."
      ]
    },
    {
      "id": "platform-reliability-engineer",
      "title": "Platform & Reliability Engineer",
      "group": "product",
      "responsibility": "Improve deployment, observability, recovery and service reliability.",
      "skills": "Cloud operations; automation; monitoring; incident diagnosis.",
      "slot": 4,
      "description": "Help keep Monderman dependable as people gather perspectives and interpret results. This position focuses on releases, service visibility and recovery, connecting operational evidence to practical improvements in reliability and support.",
      "responsibilities": [
        "Maintain repeatable build, deployment and release verification processes.",
        "Improve monitoring, service logs and actionable operational alerts.",
        "Investigate incidents and document recovery steps and follow-up improvements.",
        "Review configuration, dependencies, backups and failure modes with engineering colleagues."
      ],
      "qualifications": [
        "Experience operating cloud-hosted applications and automating repeatable tasks.",
        "Ability to diagnose failures using logs, metrics and application behavior.",
        "Careful handling of credentials, change controls and technical documentation."
      ]
    },
    {
      "id": "quality-engineer",
      "title": "Quality Engineer",
      "group": "product",
      "responsibility": "Protect diagnostic calculations, reports, PDFs and user journeys.",
      "skills": "Test design; browser automation; regression analysis; reproducibility.",
      "slot": 5,
      "description": "Protect the accuracy and usability of the journeys that produce Monderman’s diagnostic evidence. This position combines test design, browser automation and careful investigation so defects in calculations, reports, PDFs and workflows are found and explained before they affect users.",
      "responsibilities": [
        "Design checks for diagnostic calculations, report content, PDFs and user journeys.",
        "Develop maintainable automated tests and document the limits of their coverage.",
        "Reproduce defects with clear inputs, expected results and supporting evidence.",
        "Work with engineering and research colleagues to assess changes and strengthen regression protection."
      ],
      "qualifications": [
        "Experience creating test cases and investigating web application failures.",
        "Ability to use browser automation, structured data and reproducible test fixtures.",
        "Clear communication and judgment about risk, evidence and unresolved uncertainty."
      ]
    },
    {
      "id": "product-designer",
      "title": "Product Designer",
      "group": "product",
      "responsibility": "Turn organizational evidence into understandable product experiences.",
      "skills": "Interaction design; usability research; information design; plain language.",
      "slot": 6,
      "description": "Help people understand organizational evidence and decide what to examine next. This position develops the structure, language and interactions of Monderman’s product, including diagnostic participation, report interpretation and the needs of people working across teams.",
      "responsibilities": [
        "Map user journeys and turn requirements into clear flows and interface designs.",
        "Create prototypes and use feedback to improve navigation, forms and evidence displays.",
        "Design accessible information patterns for results, comparisons and limitations.",
        "Document decisions and collaborate with engineering, research and customer-facing colleagues."
      ],
      "qualifications": [
        "Experience with interaction design, information design and usability research.",
        "A portfolio or examples that explain design reasoning and tradeoffs.",
        "Strong plain-language communication and familiarity with accessible design principles."
      ]
    },
    {
      "id": "security-engineer",
      "title": "Security Engineer",
      "group": "product",
      "responsibility": "Strengthen application security and responsible data handling.",
      "skills": "Web security; authorization; threat modeling; secure development.",
      "slot": 7,
      "description": "Help protect the information people entrust to Monderman and strengthen how the platform is built and operated. This position reviews application behavior and data handling, identifies concrete security risks and helps colleagues implement and verify practical safeguards.",
      "responsibilities": [
        "Review authentication, authorization, interfaces and sensitive data flows.",
        "Develop threat models and prioritize findings according to their likely impact.",
        "Support secure development, dependency review and verification of corrective changes.",
        "Document controls, investigate reported issues and improve incident preparation."
      ],
      "qualifications": [
        "Experience assessing web application security and access controls.",
        "Ability to explain risks and work with engineers on proportionate corrective measures.",
        "Sound judgment when handling confidential information and security evidence."
      ]
    },
    {
      "id": "organizational-research-lead",
      "title": "Organizational Research Lead",
      "group": "research",
      "responsibility": "Guide research questions and connect organizational concepts to diagnostic work.",
      "skills": "Organizational research; mixed methods; study design; clear writing.",
      "slot": 8,
      "description": "Guide research connecting organizational governance to the everyday movement of work and decisions. This position frames useful questions, examines evidence and keeps Q²-SODI™ interpretation clear about what the available methods and data can support.",
      "responsibilities": [
        "Develop questions about responsibility, coordination, decisions and organizational performance.",
        "Design studies using appropriate quantitative, qualitative or mixed methods.",
        "Review evidence quality, alternative explanations and methodological limits.",
        "Translate findings into research guidance, product requirements and clear written material."
      ],
      "qualifications": [
        "Substantial experience conducting organizational or related applied research.",
        "Ability to design studies, evaluate methods and guide reproducible analysis.",
        "Clear writing and experience working across research, product or practitioner perspectives."
      ]
    },
    {
      "id": "measurement-scientist",
      "title": "Measurement Scientist",
      "group": "research",
      "responsibility": "Evaluate measures, consistency, interpretation and methodological limits.",
      "skills": "Statistics; measurement; reproducible analysis; technical communication.",
      "slot": 9,
      "description": "Help evaluate how Monderman measures organizational experiences and communicates the resulting evidence. This position examines consistency, uncertainty and interpretation, supporting methods that remain useful without making claims beyond the available data.",
      "responsibilities": [
        "Evaluate diagnostic measures, scoring behavior and the consistency of results.",
        "Design reproducible analyses of missing data, sensitivity and uncertainty.",
        "Review proposed measure changes and document their methodological implications.",
        "Explain findings and limits to research, engineering and customer-facing colleagues."
      ],
      "qualifications": [
        "Experience with statistics, measurement or quantitative research methods.",
        "Ability to prepare reproducible analyses and review assumptions behind numerical results.",
        "Skill in explaining technical findings accurately to different audiences."
      ]
    },
    {
      "id": "research-analyst-1",
      "title": "Research Analyst (position 1)",
      "group": "research",
      "responsibility": "Review evidence, analyze structured data and prepare research findings.",
      "skills": "Literature review; quantitative analysis; source checking; writing.",
      "slot": 10,
      "description": "Help turn published research and structured organizational data into clear, traceable findings. This position supports evidence reviews and analysis, keeping sources, methods and the distinction between observation and interpretation visible.",
      "responsibilities": [
        "Locate, review and organize relevant research with accurate source records.",
        "Prepare and analyze structured data using documented, repeatable methods.",
        "Check tables, claims and citations and record uncertainty or conflicting evidence.",
        "Draft research summaries and collaborate on internal and public research material."
      ],
      "qualifications": [
        "Experience with literature review, quantitative analysis or applied research projects.",
        "Ability to work carefully with spreadsheets or statistical tools and maintain records.",
        "Strong reading, source-checking and clear writing skills."
      ]
    },
    {
      "id": "research-analyst-2",
      "title": "Research Analyst (position 2)",
      "group": "research",
      "responsibility": "Support research across additional organizational settings.",
      "skills": "Data analysis; qualitative synthesis; documentation; evidence appraisal.",
      "slot": 11,
      "description": "Help examine how organizational patterns vary across settings and types of work. This position supports research synthesis and analysis, bringing together structured data and qualitative evidence while documenting the context and limits of each conclusion.",
      "responsibilities": [
        "Review research and organize evidence from different organizational settings.",
        "Analyze structured data and synthesize qualitative material with documented methods.",
        "Identify gaps, inconsistent findings and questions needing further investigation.",
        "Prepare research notes, comparison tables and clear summaries for colleagues."
      ],
      "qualifications": [
        "Experience with data analysis, qualitative synthesis or evidence appraisal.",
        "Ability to maintain records of sources, methods and analytical decisions.",
        "Careful judgment and writing that distinguishes evidence from inference."
      ]
    },
    {
      "id": "implementation-consultant-1",
      "title": "Implementation Consultant (position 1)",
      "group": "delivery",
      "responsibility": "Help organizations define scope, gather perspectives and interpret findings.",
      "skills": "Facilitation; organizational analysis; project coordination; communication.",
      "slot": 12,
      "description": "Help organizations use Monderman to examine a clearly defined area of work. This position supports scoping, gathering perspectives and report interpretation, helping participants understand the evidence and identify practical questions for discussion.",
      "responsibilities": [
        "Define a diagnostic’s scope and purpose with organizational contacts.",
        "Coordinate participation and explain the process in accessible language.",
        "Facilitate discussion of findings, differing perspectives and possible next steps.",
        "Document decisions and communicate product or method questions to colleagues."
      ],
      "qualifications": [
        "Experience in facilitation, organizational analysis or implementation work.",
        "Ability to coordinate stakeholders and explain reports without overstating conclusions.",
        "Clear communication, discretion and an organized approach to delivery."
      ]
    },
    {
      "id": "implementation-consultant-2",
      "title": "Implementation Consultant (position 2)",
      "group": "delivery",
      "responsibility": "Support additional implementations and translate findings into practical next steps.",
      "skills": "Implementation planning; stakeholder coordination; report interpretation.",
      "slot": 13,
      "description": "Help organizations translate diagnostic findings into a practical plan for examining and improving work. This position supports implementation and stakeholder coordination, keeping the connection between evidence, assumptions and proposed changes clear throughout the engagement.",
      "responsibilities": [
        "Plan and coordinate implementations with organizational contacts.",
        "Help participants interpret findings in the context of their work.",
        "Support discussions of priorities, operating assumptions and implementation constraints.",
        "Maintain project records and share recurring questions with product and research colleagues."
      ],
      "qualifications": [
        "Experience with implementation planning, project coordination or organizational consulting.",
        "Ability to facilitate constructive discussion across different roles and perspectives.",
        "Sound judgment about confidentiality and clear, evidence-based communication."
      ]
    },
    {
      "id": "customer-success-manager",
      "title": "Customer Success Manager",
      "group": "delivery",
      "responsibility": "Help customers establish useful working practices and communicate product feedback.",
      "skills": "Onboarding; account coordination; adoption planning; listening.",
      "slot": 14,
      "description": "Help customers establish useful working practices with Monderman and understand what they can achieve with the platform. This position combines onboarding, adoption planning and careful listening, connecting customer needs with realistic guidance and useful feedback for colleagues.",
      "responsibilities": [
        "Coordinate onboarding and help customers define practical product goals.",
        "Explain workflows and support plans for participation and report discussion.",
        "Track questions, obstacles and agreed actions with customer contacts.",
        "Communicate recurring needs and feedback to support, research and engineering colleagues."
      ],
      "qualifications": [
        "Experience in customer success, onboarding, account coordination or related service work.",
        "Ability to listen, manage priorities and explain complex information simply.",
        "An organized approach to follow-through and setting accurate expectations."
      ]
    },
    {
      "id": "solutions-engineer",
      "title": "Solutions Engineer",
      "group": "delivery",
      "responsibility": "Explain product fit and translate organizational requirements into feasible solutions.",
      "skills": "Product demonstrations; technical discovery; integration analysis; documentation.",
      "slot": 15,
      "description": "Help prospective customers and partners understand where Monderman fits their needs. This position connects technical discovery with clear demonstrations, documenting platform capabilities, workflow requirements and requests that need further investigation.",
      "responsibilities": [
        "Lead technical discovery and document requirements and constraints.",
        "Prepare demonstrations using appropriate illustrative or synthetic material.",
        "Assess proposed integrations and explain feasible approaches and current limits.",
        "Coordinate accurate solution guidance with commercial, delivery and engineering colleagues."
      ],
      "qualifications": [
        "Experience explaining SaaS products and translating business needs into technical requirements.",
        "Working knowledge of web applications, data flows and integration concepts.",
        "Clear presentation and documentation skills, including knowing when to verify an answer."
      ]
    },
    {
      "id": "support-documentation-specialist",
      "title": "Support & Documentation Specialist",
      "group": "delivery",
      "responsibility": "Resolve product questions and maintain clear help materials.",
      "skills": "Troubleshooting; technical writing; issue reproduction; customer communication.",
      "slot": 16,
      "description": "Help people resolve product questions and find clear guidance when they need it. This position combines patient support, careful issue reproduction and useful documentation, improving the materials and feedback that make Monderman easier to use.",
      "responsibilities": [
        "Respond to questions and guide appropriate troubleshooting steps.",
        "Reproduce issues with clear, privacy-conscious records for engineering colleagues.",
        "Write and maintain help articles, workflow guides and release explanations.",
        "Identify recurring confusion and recommend improvements to product guidance."
      ],
      "qualifications": [
        "Experience with technical support, documentation or customer-facing troubleshooting.",
        "Ability to explain technical steps and adapt writing to different audiences.",
        "Careful handling of user information and organized issue tracking."
      ]
    },
    {
      "id": "content-research-communications-specialist",
      "title": "Content & Research Communications Specialist",
      "group": "operations",
      "responsibility": "Explain Monderman’s methods, findings and potential ROI accurately.",
      "skills": "Research editing; B2B writing; evidence checking; content planning.",
      "slot": 17,
      "description": "Explain Monderman’s work to organizational leaders, practitioners and researchers. This position develops research-informed material about the platform and its methods, with particular care over evidence, estimates and claims about time, money and capacity.",
      "responsibilities": [
        "Write and edit articles, product explanations and research summaries.",
        "Check sources and distinguish findings, capabilities and estimated benefits.",
        "Coordinate content plans and maintain consistent published terminology.",
        "Collaborate with research, product and commercial colleagues on understandable explanations."
      ],
      "qualifications": [
        "Experience with research editing, B2B writing or technical communications.",
        "Ability to evaluate sources and preserve nuance in plain language.",
        "Writing samples demonstrating accuracy, structure and audience awareness."
      ]
    },
    {
      "id": "consultant-partnerships-manager",
      "title": "Consultant Partnerships Manager",
      "group": "operations",
      "responsibility": "Develop relationships and useful enablement materials for consulting partners.",
      "skills": "Partnership development; facilitation; training; commercial coordination.",
      "slot": 18,
      "description": "Help consulting partners understand how Monderman can support their work with organizations. This position develops relationships and practical enablement materials, keeping product fit, partner responsibilities and the interpretation of evidence clear.",
      "responsibilities": [
        "Develop relationships with consulting partners and prospective partners.",
        "Understand partners’ service models and assess appropriate platform uses.",
        "Coordinate demonstrations, learning materials and practical partner guidance.",
        "Document agreed actions and share feedback with product, research and delivery colleagues."
      ],
      "qualifications": [
        "Experience with partnership development, consulting, training or related commercial work.",
        "Ability to facilitate discussion and explain capabilities and limitations accurately.",
        "Clear communication, reliable follow-through and sound professional judgment."
      ]
    },
    {
      "id": "business-development-manager",
      "title": "Business Development Manager",
      "group": "operations",
      "responsibility": "Understand prospective customers’ needs and assess genuine product fit.",
      "skills": "Discovery conversations; SaaS sales; business cases; clear communication.",
      "slot": 19,
      "description": "Help organizations decide whether Monderman fits the problems they want to examine. This position focuses on thoughtful discovery, clear product explanations and realistic business cases, connecting prospective customers’ needs with an appropriate next step.",
      "responsibilities": [
        "Develop and manage conversations with prospective organizational customers.",
        "Explore workflows, decision delays and other problems relevant to product fit.",
        "Explain the platform, evaluations and assumptions behind estimated benefits.",
        "Maintain accurate opportunity records and coordinate technical and delivery handoffs."
      ],
      "qualifications": [
        "Experience in SaaS sales, business development or consultative discovery.",
        "Ability to build business cases without promising unsupported outcomes.",
        "Strong writing and an organized, respectful approach to follow-up."
      ]
    },
    {
      "id": "business-operations-generalist",
      "title": "Business Operations Generalist",
      "group": "operations",
      "responsibility": "Coordinate internal processes, suppliers, records and operational priorities.",
      "skills": "Operations; budgeting support; process documentation; organization.",
      "slot": 20,
      "description": "Help keep Monderman’s everyday work organized and documented. This position supports internal processes, supplier coordination and operational records, helping colleagues make responsibilities, priorities and follow-through clear.",
      "responsibilities": [
        "Coordinate internal tasks, supplier information and operational deadlines.",
        "Maintain process documents, records and routine management information.",
        "Support budgeting and purchasing administration within agreed responsibilities and approvals.",
        "Identify recurring administrative problems and help implement practical improvements."
      ],
      "qualifications": [
        "Experience in business operations, administration or project coordination.",
        "Ability to organize information, use spreadsheets and maintain accurate records.",
        "Clear communication, discretion and a practical approach to everyday problems."
      ]
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
      "code": "FL",
      "name": "Florida"
    },
    {
      "code": "GA",
      "name": "Georgia"
    },
    {
      "code": "ID",
      "name": "Idaho"
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
      "code": "MI",
      "name": "Michigan"
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
      "code": "NH",
      "name": "New Hampshire"
    },
    {
      "code": "NM",
      "name": "New Mexico"
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
  ],
  "workLocationPolicyId": "careers-work-locations-20261018.1"
};
  [data.roles, data.groups, data.workStates].forEach(function (rows) { rows.forEach(Object.freeze); Object.freeze(rows); });
  return Object.freeze(data);
});
