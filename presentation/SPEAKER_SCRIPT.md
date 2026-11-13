# ScholarAI – Speaker Script & Viva Q&A (CSE 276)

**Project Title:** AI Scholarship Information Chatbox (**ScholarAI**)  
**Tagline:** *"Your Future. Your Scholarship. One Intelligent Assistant."*  
**Course:** CSE 276 (B.Tech CSE – AI & ML)  
**Team Members:** Naved (12526356) · Chinmay Kirange (12525866) · Aryan (12521705)

> **Pacing Guide:** Target ~45–60 seconds per slide (11 slides ≈ 9–10 minutes total, leaving comfortable room for viva questions).

---

## Slide 1 — Title Slide (~45 sec)
Good morning respected faculty and evaluators. Today our team — Naved, Chinmay Kirange, and Aryan — presents our CSE 276 B.Tech AI and ML project: **ScholarAI**, our **AI Scholarship Information Chatbox**. Our guiding tagline is: *"Your Future. Your Scholarship. One Intelligent Assistant."* The core idea behind ScholarAI is to replace hours of fragmented searching across multiple Indian scholarship portals with a transparent, rule-verified conversational assistant built for college students.

---

## Slide 2 — Introduction (~50 sec)
Let us begin with the problem students face every academic year. A scholarship provides crucial financial support based on academic merit, financial need, or reserved category eligibility. However, students across India struggle with three everyday hurdles: first, information is scattered across the National Scholarship Portal (`scholarships.gov.in`), AICTE, UGC, and individual state websites; second, official PDF circulars mix multiple CGPA, income, and domicile conditions that are confusing to interpret manually; and third, poor visibility leads to missed deadlines. Artificial intelligence can simplify discovery through natural dialogue, which is why we built **ScholarAI** — an assistant that pairs conversational discovery with strict eligibility rules.

---

## Slide 3 — Objectives and Scope (~50 sec)
Our project has six focused objectives: building an AI-powered scholarship chatbox, supporting natural-language student questions, matching profiles via deterministic eligibility logic, saving manual search time, guiding students on required documents and application workflows, and returning transparent citation-backed responses. On the scope side, ScholarAI focuses on Indian government, AICTE, UGC, state, and private foundation schemes for UG and PG students, spanning merit-based and need-based support, privacy-safe eligibility checking without collecting Aadhaar or bank details, and end-to-end application guidance.

---

## Slide 4 — Research Gap & Existing System Limitations (~55 sec)
When we studied existing portals, we identified six key gaps. Eligibility information is fragmented across unrelated websites, forcing students to manually read long legal circulars. Existing portals offer static dropdown filtering rather than personalized multi-criteria search, document checklists are hard to track, deadlines are frequently missed, and dense official wording overwhelms applicants. As summarized in our comparison table, traditional portals rely on static keyword lookup and unstructured PDFs, whereas ScholarAI combines hybrid semantic ChromaDB retrieval, structured JSON and entity-relation knowledge representation, RAG-grounded answers, and context-aware conversational follow-ups.

---

## Slide 5 — Proposed Methodology (~60 sec)
Slide 5 walks through our eight-step rational methodology pipeline:
1. A student submits a natural-language **User Query**, which is first checked and scrubbed for sensitive personal identifiers.
2. Our **Intent Identification** module classifies the request—for example discovery, eligibility check, documents, or deadlines.
3. **Information Extraction** parses only non-identifying eligibility attributes such as course, CGPA, annual family income, domicile state, and category.
4. **Knowledge Representation** aligns those student attributes with our structured scholarship entity schema.
5. **Scholarship Record Retrieval** searches SQLite using structured filters and keyword scoring.
6. **RAG Document Retrieval** queries ChromaDB embeddings over scholarship records and ingested official PDF guidelines.
7. Our **LLM or Demo Provider** synthesizes a grounded answer without inventing deadlines or amounts.
8. Finally, the student receives a **Cited Answer** complete with official portal links, confidence badge, and a step-by-step eligibility explanation.

---

## Slide 6 — System Architecture & AI Concepts (~60 sec)
Slide 6 connects our software architecture directly to three core CSE AI & ML concepts. At the top, requests flow cleanly from the student through our React TypeScript frontend to the FastAPI backend, into the intent-entity extractor and the Rational Agent loop, backed by our SQLite Knowledge Base and ChromaDB Vector Store before grounded synthesis.
- **Knowledge Representation**: Every scholarship is structured cleanly as typed entities and relationships linking students, courses, domicile states, minimum cutoffs, organizations, and required documents.
- **Rational Agent Loop**: Our agent follows a clear `Perceive → Interpret → Retrieve → Evaluate → Decide → Respond` cycle, asking clarifying follow-ups whenever student details are incomplete.
- **LLM + RAG**: Embedding queries and passing only top-k retrieved context avoids hallucination and anchors every output with explicit official citations.

---

## Slide 7 — Functionality, Live Previews & Expected Outcomes (~55 sec)
Here is a breakdown of what is currently implemented versus prototyped on our platform. All core functional modules—including Hybrid Scholarship Discovery, Deterministic Eligibility Checking, Profile-based Matching, Application Guides, Document Checklists, Source Citations, and the `"How did AI reach this result?"` Explanation Trace—are **Implemented**. Our Conversational Chatbox LLM synthesis is marked **Prototype**, because it supports Google Gemini via an abstraction layer while running deterministically in transparent Demo Mode whenever no API key is configured. On the right, you can see our four key views: Landing page, AI Chat interface, grouped Eligibility results, and Scholarship Detail citations. Qualitatively, ScholarAI aims to reduce search friction, improve eligibility clarity, and build student confidence through honest verified-versus-sample labeling.

---

## Slide 8 — Tools and Technologies (~50 sec)
Slide 8 transparently presents every technology with its verified project status. For the frontend, **React.js, TypeScript, and Tailwind CSS** are **Implemented**. For the backend, **Python and FastAPI** are **Implemented**. Under AI and ML, our **RAG Pipeline** is **Implemented**, **LLM integration** is marked as **Prototype** due to offline Demo fallback support alongside Gemini, while **Sentence Transformers** and **LangChain** are explicitly marked **Proposed** for future modular expansion—we built our current pipeline directly using the official Google GenAI SDK and clean provider interfaces. Knowledge retrieval uses **ChromaDB** and our **Structured JSON Knowledge Base** (**Implemented**), backed by **SQLite** with PostgreSQL-compatible SQLAlchemy models (**Implemented**), developed using **Google Antigravity, VS Code, Git, and GitHub**.

---

## Slide 9 — Conclusion (~45 sec)
To conclude, ScholarAI demonstrates how combining AI retrieval with strict deterministic logic makes educational financial aid far more accessible:
1. It centralizes scholarship discovery across fragmented portals.
2. Deterministic rules simplify complex multi-condition eligibility without guesswork.
3. Retrieval-Augmented Generation improves relevance while preventing fabricated figures.
4. Structured knowledge representation organizes criteria, documents, and states cleanly.
5. Rational-agent reasoning enables natural follow-up dialogues and transparent decisions.
6. Explicit `Verified` versus `Sample` warnings and zero-PII collection earn student trust.

---

## Slide 10 — Future Scope (~45 sec)
Looking ahead, our eight-point roadmap focuses on scaling impact: adding **multilingual chat** in English, Hindi, and regional languages; building live connectors with **government portals** like NSP, AICTE, and state systems; enabling automated **deadline alerts**; adding intelligent **PDF/marksheet document checking**; enhancing personalized ranking; launching a dedicated **mobile application**; migrating knowledge triples to a native **graph database**; and introducing advanced multi-step application planning agents.

---

## Slide 11 — Thank You (~25 sec)
Thank you very much for your time and attention. We truly believe in *"Empowering Every Student Through Intelligent Scholarship Discovery."* On behalf of our team—Naved, Chinmay Kirange, and Aryan—we are now happy to answer your questions or show a live walkthrough of ScholarAI.

---

## Likely Viva Q&A (Slides 5, 6 & 8)

### Slide 5 (Proposed Methodology)
- **Q1: Why do you separate eligibility evaluation from the LLM instead of letting the LLM decide eligibility?**
  - **Answer:** LLMs are probabilistic and can misread numeric boundaries like `CGPA >= 8.0` or `income <= ₹2,50,000`. Separating a pure deterministic Python rule engine guarantees 100% consistent `Eligible / Potentially Eligible / Not Eligible` classifications, while the LLM focuses solely on natural explanation and citation formatting.
- **Q2: How do you handle incomplete student queries like *"Am I eligible for a scholarship?"*?**
  - **Answer:** Step 3 extracts whichever attributes exist, Step 5 classifies missing criteria as `"Verification Required"` (`Potentially Eligible`), and the Rational Agent explicitly triggers follow-up prompts asking only for missing non-identifying fields like course, income, state, or category.
- **Q3: How is student privacy protected inside this methodology?**
  - **Answer:** Step 1 includes a regex-based PII scrubber that redacts accidental Aadhaar numbers, PAN cards, phone numbers, emails, or bank details before retrieval or LLM calls, and no personal student profiles are persisted on the backend.

### Slide 6 (System Architecture & AI Concepts)
- **Q4: How does ScholarAI behave as a Rational Agent?**
  - **Answer:** It implements a continuous `Perceive → Interpret → Retrieve → Evaluate → Decide → Respond` cycle. Given a user percept and environment knowledge base, it selects retrieval + deterministic rule verification actions to maximize grounded accuracy, handles missing state via clarifying questions, and exposes an explainable reasoning trace (`"How did AI reach this result?"`).
- **Q5: Why did you design Knowledge Representation with separate entities (`Organization`, `Course`, `State`, `Document`, `KnowledgeEdge`) if the dataset starts as JSON?**
  - **Answer:** Normalizing scholarships into structured entity-relation triples ensures consistent filtering today via SQLite and prepares the exact data model for a dedicated graph database (like Neo4j) without redesigning the schema later.
- **Q6: What prevents your RAG pipeline from hallucinating deadlines or scholarship amounts?**
  - **Answer:** Our system prompt restricts generation strictly to top-k retrieved context, unconfirmed cycle dates are stored honestly as `null`, and the UI clearly labels unverified entries as **`Sample data – verify on official site`** alongside a mandatory `"Final eligibility is decided by the provider"` notice.

### Slide 8 (Tools & Technologies)
- **Q7: Why is LangChain marked `Proposed` while your backend already runs RAG and agents?**
  - **Answer:** To keep the codebase lightweight, transparent, and academic-auditable, we implemented our own abstract `LLMProvider`, `EmbeddingProvider`, hybrid RRF retriever, and 8-stage rational agent loop directly using `google-genai` and ChromaDB. Integrating LangChain is marked `Proposed` for teams wanting drop-in chain orchestration or multi-tool extensions later.
- **Q8: Why did you choose ChromaDB over FAISS, and what happens without an API key?**
  - **Answer:** ChromaDB provides persistent local vector storage with native metadata filtering out of the box, which suits category/state/income scholarship queries cleanly. When `GEMINI_API_KEY` is absent, our `EmbeddingProvider` and `LLMProvider` switch cleanly to deterministic `DemoProvider` implementations (`Demo Mode`) using mode-isolated Chroma collections (`_demo` vs `_gemini`) so vector dimensions never clash.
- **Q9: Can SQLite scale if deployed for a university campus?**
  - **Answer:** Yes—because we used SQLAlchemy 2.0 ORM abstractions without SQLite-locked raw SQL queries, updating `DATABASE_URL` in `.env` switches cleanly to PostgreSQL.
