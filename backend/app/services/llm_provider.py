from abc import ABC, abstractmethod
import json
from pydantic import BaseModel, Field
from google import genai

from app.schemas.chat import ChatMessageInput, IntentType
from app.schemas.eligibility import EligibilityCheckResponse, StudentProfile
from app.rag.retriever import RetrievedDocumentChunk, RetrievedScholarship
from app.utils.config import get_settings


class LLMGeneratedAnswer(BaseModel):
    answer_markdown: str = Field(
        description="Helpful, well-structured Markdown response citing retrieved scholarships like [1], [2]. Never invent deadlines, criteria, or amounts."
    )
    eligibility_reasoning: str = Field(
        description="Concise explanation of rule-based eligibility matches, or why additional student attributes are needed."
    )
    limitations: list[str] = Field(
        description="Honest caveats such as missing profile details, unverified sample records, or unconfirmed cycle deadlines."
    )
    follow_up_questions: list[str] = Field(
        description="Up to 3 short follow-up prompts or questions to help the student refine their scholarship search."
    )


RAG_SYSTEM_PROMPT = """You are ScholarAI ("Your Future. Your Scholarship. One Intelligent Assistant."), an honest, privacy-first scholarship advisor for Indian students.

STRICT GROUNDING RULES (MUST FOLLOW):
1. Use ONLY the retrieved scholarship records, retrieved PDF document excerpts, and deterministic eligibility results provided in the prompt context.
2. NEVER invent, guess, or extrapolate official deadlines, amounts, income limits, or eligibility rules.
3. If deadline or amount or any detail is null or missing in the retrieved context, explicitly state "information not available on file – verify on the official portal".
4. Explicitly distinguish between `verified` schemes and `sample` records ("Sample data – verify on official site").
5. When student eligibility attributes are missing (e.g., for "Am I eligible?"), ask clear follow-up questions to collect only non-identifying attributes (education level, course, CGPA/percentage, annual family income, domicile state, category).
6. NEVER ask for Aadhaar, PAN, bank account numbers, passwords, or OTPs.
7. Include inline source numbers [1], [2] matching the provided retrieved sources list.
8. Remind the user that final eligibility is decided by the scholarship provider."""


class LLMProvider(ABC):
    provider_name: str
    is_demo: bool

    @abstractmethod
    def generate_rag_response(
        self,
        query: str,
        intent: IntentType,
        profile: StudentProfile,
        retrieved: list[RetrievedScholarship],
        doc_chunks: list[RetrievedDocumentChunk],
        eligibility_result: EligibilityCheckResponse | None,
        history: list[ChatMessageInput],
    ) -> LLMGeneratedAnswer:
        ...


class DemoProvider(LLMProvider):
    """Deterministic grounded response generator when GEMINI_API_KEY is missing."""

    provider_name = "DemoProvider"
    is_demo = True

    def generate_rag_response(
        self,
        query: str,
        intent: IntentType,
        profile: StudentProfile,
        retrieved: list[RetrievedScholarship],
        doc_chunks: list[RetrievedDocumentChunk],
        eligibility_result: EligibilityCheckResponse | None,
        history: list[ChatMessageInput],
    ) -> LLMGeneratedAnswer:
        limitations: list[str] = [
            "Demo Mode active (GEMINI_API_KEY not configured): using deterministic rule & retrieval synthesis rather than a live LLM."
        ]
        follow_ups: list[str] = []

        if any(r.scholarship.source_status == "sample" for r in retrieved):
            limitations.append(
                "One or more retrieved scholarships are marked as Sample data – verify exact criteria, amounts, and deadlines on the official portal."
            )

        if intent == "general" and not retrieved:
            return LLMGeneratedAnswer(
                answer_markdown=(
                    "Hello! I'm **ScholarAI** (*Demo Mode*), your scholarship assistant for Indian students.\n\n"
                    "I can help you:\n"
                    "- **Discover scholarships** for B.Tech, UG, PG, and Diploma courses\n"
                    "- **Check deterministic eligibility** using your course, CGPA/percentage, family income, state, and category\n"
                    "- **Review required documents** and step-by-step application portals (NSP, AICTE, State & Private schemes)\n\n"
                    "Try asking: *\"What scholarships are available for B.Tech students with 8.5 CGPA and income below 3 lakh?\"*"
                ),
                eligibility_reasoning="No student eligibility attributes provided yet.",
                limitations=limitations,
                follow_up_questions=[
                    "What scholarships are available for B.Tech students?",
                    "Am I eligible for a scholarship?",
                    "What documents are required for NSP scholarships?",
                ],
            )

        if not retrieved:
            limitations.append("No matching scholarship records met your query criteria in the local knowledge base.")
            return LLMGeneratedAnswer(
                answer_markdown=(
                    "I could not find matching scholarships in the current local knowledge base for that query.\n\n"
                    "Try broadening your search terms (for example: `B.Tech`, `NSP`, `AICTE Pragati`, `Maharashtra`, or `low-income`) "
                    "or use the **Eligibility Checker** with your academic and income details."
                ),
                eligibility_reasoning="Zero matching records retrieved from ChromaDB and SQLite keyword search.",
                limitations=limitations,
                follow_up_questions=[
                    "What scholarships are available for B.Tech students?",
                    "Find scholarships for students from low-income families.",
                    "What documents are required for NSP scholarships?",
                ],
            )

        lines: list[str] = []
        eval_map = {}
        if eligibility_result:
            for item in (
                eligibility_result.eligible
                + eligibility_result.potentially_eligible
                + eligibility_result.not_eligible
            ):
                eval_map[item.scholarship.id] = item

        # Intent-aware deterministic synthesis strictly from retrieved data
        if intent == "documents":
            lines.append("Based on the retrieved scholarship records, here are the required documents:\n")
            for idx, item in enumerate(retrieved[:5], start=1):
                s = item.scholarship
                badge = "Verified" if s.source_status == "verified" else "Sample data – verify on official site"
                docs = ", ".join(s.required_documents) if s.required_documents else "Information not available"
                lines.append(f"**[{idx}] {s.name}** (*{badge}*)")
                lines.append(f"- **Required Documents:** {docs}")
                lines.append(f"- **Official Portal:** {s.official_url}\n")

        elif intent == "deadlines":
            lines.append("Here is the deadline information currently available in the retrieved records:\n")
            any_deadline = False
            for idx, item in enumerate(retrieved[:5], start=1):
                s = item.scholarship
                badge = "Verified" if s.source_status == "verified" else "Sample data – verify on official site"
                dl = s.deadline if s.deadline else "Information not available – verify on official portal"
                if s.deadline:
                    any_deadline = True
                lines.append(f"- **[{idx}] {s.name}** (*{badge}*): **Deadline:** {dl} · [Official Portal]({s.official_url})")
            if not any_deadline:
                limitations.append("Current academic cycle closing dates are not confirmed in the static knowledge base; always check the official portal notice board.")

        elif intent == "application_guidance":
            lines.append("Here is the step-by-step application guidance from the retrieved schemes:\n")
            for idx, item in enumerate(retrieved[:4], start=1):
                s = item.scholarship
                badge = "Verified" if s.source_status == "verified" else "Sample data – verify on official site"
                lines.append(f"### [{idx}] {s.name} (*{badge}*)")
                lines.append(f"- **Provider:** {s.provider}")
                lines.append(f"- **Benefit:** {s.amount or 'Information not available'}")
                if s.application_steps:
                    for step_no, step_txt in enumerate(s.application_steps, start=1):
                        lines.append(f"  {step_no}. {step_txt}")
                else:
                    lines.append("  - Step-by-step guide: Information not available (check official URL).")
                lines.append(f"- **Official Link:** {s.official_url}\n")

        else:
            # Discovery or Eligibility
            if eligibility_result and (
                profile.course
                or profile.education_level
                or profile.cgpa is not None
                or profile.percentage is not None
                or profile.family_income is not None
                or profile.state
                or profile.category
                or profile.gender
            ):
                lines.append("Here are the top matching scholarships based on your details and deterministic eligibility rules:\n")
            else:
                lines.append("Here are the top matching scholarships found in our knowledge base:\n")

            for idx, item in enumerate(retrieved[:5], start=1):
                s = item.scholarship
                badge = "Verified" if s.source_status == "verified" else "Sample data – verify on official site"
                ev = eval_map.get(s.id)
                status_tag = ""
                if ev:
                    label_map = {
                        "eligible": "Eligible",
                        "potentially_eligible": "Potentially Eligible",
                        "not_eligible": "Not Eligible",
                    }
                    status_tag = f" · **Rule Status:** `{label_map[ev.status]}`"

                lines.append(f"**[{idx}] {s.name}** (*{badge}*){status_tag}")
                lines.append(f"- **Provider:** {s.provider} ({s.type.title()} / {s.basis.title()})")
                lines.append(f"- **Benefit:** {s.amount or 'Information not available'}")
                lines.append(
                    f"- **Income Ceiling:** {f'₹{int(s.max_family_income):,}/year' if s.max_family_income is not None else 'No fixed ceiling / Not specified'}"
                )
                lines.append(f"- **Deadline:** {s.deadline or 'Information not available – verify on official portal'}")
                if ev and ev.met_conditions:
                    lines.append(f"- **Matched Rules:** {'; '.join(ev.met_conditions[:3])}")
                if ev and ev.missing_requirements:
                    lines.append(f"- **Needs Confirmation:** {'; '.join(ev.missing_requirements[:2])}")
                if ev and ev.unmet_conditions:
                    lines.append(f"- **Unmet Criteria:** {'; '.join(ev.unmet_conditions[:2])}")
                lines.append(f"- **Official Portal:** {s.official_url}\n")

        if doc_chunks:
            lines.append("\n**Relevant Uploaded PDF Excerpts:**")
            for chunk in doc_chunks[:2]:
                excerpt = chunk.text.strip().replace("\n", " ")[:240]
                lines.append(f"- *{chunk.filename}*: \"{excerpt}...\"")

        # Follow-ups & Eligibility reasoning
        eligibility_reasoning = "Evaluated via deterministic rule matching against retrieved scholarship constraints."
        if eligibility_result and eligibility_result.missing_profile_fields:
            missing_str = ", ".join(eligibility_result.missing_profile_fields[:4])
            limitations.append(f"Missing student attributes ({missing_str}) prevent full confirmation on category/state/income-gated schemes.")
            if intent == "eligibility" or len(eligibility_result.missing_profile_fields) >= 4:
                lines.append(
                    f"\nTo check your exact eligibility accurately, please share (without any Aadhaar/bank details): **{missing_str}**."
                )
            eligibility_reasoning = (
                f"Deterministic rule check evaluated {eligibility_result.summary['total_evaluated']} active scholarships: "
                f"{eligibility_result.summary['eligible_count']} eligible, "
                f"{eligibility_result.summary['potentially_eligible_count']} potentially eligible, "
                f"{eligibility_result.summary['not_eligible_count']} not eligible. "
                f"Missing attributes: {missing_str}."
            )
            follow_ups = [
                "I am a B.Tech student with 8.5 CGPA and family income below 3 lakh.",
                f"My domicile state is Maharashtra and category is General." if not profile.state else f"What documents do I need for {retrieved[0].scholarship.name}?",
                "What is the application process for NSP scholarships?",
            ]
        else:
            if eligibility_result:
                eligibility_reasoning = (
                    f"Deterministic rules confirmed {eligibility_result.summary['eligible_count']} eligible, "
                    f"{eligibility_result.summary['potentially_eligible_count']} potentially eligible, and "
                    f"{eligibility_result.summary['not_eligible_count']} not eligible schemes."
                )
            follow_ups = [
                f"What documents are required for {retrieved[0].scholarship.name}?",
                f"How do I apply for {retrieved[0].scholarship.name}?",
                "What is the last date to apply?",
            ]

        lines.append("\n> **Disclaimer:** Final eligibility is decided by the provider.")

        return LLMGeneratedAnswer(
            answer_markdown="\n".join(lines),
            eligibility_reasoning=eligibility_reasoning,
            limitations=list(dict.fromkeys(limitations)),
            follow_up_questions=follow_ups[:3],
        )


class GeminiProvider(LLMProvider):
    """Live Google Gemini API provider via official google-genai Interactions API."""

    provider_name = "GeminiProvider"
    is_demo = False

    def __init__(self, api_key: str, model_name: str):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name
        self._fallback = DemoProvider()

    def generate_rag_response(
        self,
        query: str,
        intent: IntentType,
        profile: StudentProfile,
        retrieved: list[RetrievedScholarship],
        doc_chunks: list[RetrievedDocumentChunk],
        eligibility_result: EligibilityCheckResponse | None,
        history: list[ChatMessageInput],
    ) -> LLMGeneratedAnswer:
        # Build strictly non-PII grounded prompt
        sources_block = []
        for idx, item in enumerate(retrieved, start=1):
            s = item.scholarship
            sources_block.append(
                {
                    "citation_index": idx,
                    "id": s.id,
                    "name": s.name,
                    "provider": s.provider,
                    "type": s.type,
                    "basis": s.basis,
                    "education_level": s.education_level,
                    "course": s.course,
                    "min_percentage": s.min_percentage,
                    "min_cgpa": s.min_cgpa,
                    "max_family_income_inr": s.max_family_income,
                    "states": s.states,
                    "categories": s.categories,
                    "gender_requirement": s.gender_requirement,
                    "amount": s.amount or "Information not available",
                    "deadline": s.deadline or "Information not available",
                    "required_documents": s.required_documents,
                    "official_url": s.official_url,
                    "source_status": s.source_status,
                    "last_verified": s.last_verified or "Not verified",
                    "eligibility_notes": s.eligibility_notes,
                    "application_steps": s.application_steps,
                }
            )

        eval_summary = []
        if eligibility_result:
            for ev in (eligibility_result.eligible + eligibility_result.potentially_eligible)[:10]:
                eval_summary.append(
                    {
                        "scholarship_id": ev.scholarship.id,
                        "status": ev.status,
                        "met_conditions": ev.met_conditions,
                        "missing_requirements": ev.missing_requirements,
                    }
                )

        recent_history = [
            {"role": m.role, "content": m.content[:600]} for m in history[-4:]
        ]

        prompt_payload = {
            "user_query": query,
            "detected_intent": intent,
            "non_identifying_student_profile": profile.model_dump(exclude_none=True),
            "missing_profile_fields": eligibility_result.missing_profile_fields if eligibility_result else [],
            "retrieved_scholarships": sources_block,
            "deterministic_eligibility_results": eval_summary,
            "retrieved_pdf_excerpts": [
                {"filename": c.filename, "scholarship_id": c.scholarship_id, "text": c.text[:500]}
                for c in doc_chunks[:3]
            ],
            "recent_conversation_context": recent_history,
        }

        prompt_str = (
            "Answer the student's scholarship query strictly using ONLY the JSON context below.\n"
            "Do not invent deadlines, amounts, or rules. Cite sources with [1], [2], etc.\n\n"
            f"CONTEXT JSON:\n{json.dumps(prompt_payload, ensure_ascii=False, indent=2)}"
        )

        try:
            interaction = self.client.interactions.create(
                model=self.model_name,
                system_instruction=RAG_SYSTEM_PROMPT,
                input=prompt_str,
                response_format={
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": LLMGeneratedAnswer.model_json_schema(),
                },
                generation_config={"thinking_level": "low"},
                store=False,
            )
            parsed = LLMGeneratedAnswer.model_validate_json(interaction.output_text)
            if "Final eligibility is decided by the provider." not in parsed.answer_markdown:
                parsed.answer_markdown += "\n\n> **Disclaimer:** Final eligibility is decided by the provider."
            return parsed
        except Exception as exc:
            fallback_res = self._fallback.generate_rag_response(
                query=query,
                intent=intent,
                profile=profile,
                retrieved=retrieved,
                doc_chunks=doc_chunks,
                eligibility_result=eligibility_result,
                history=history,
            )
            fallback_res.limitations.insert(
                0,
                f"Live Gemini API call failed ({type(exc).__name__}); returned deterministic grounded response instead.",
            )
            return fallback_res


def get_llm_provider() -> LLMProvider:
    settings = get_settings()
    if settings.is_demo_mode:
        return DemoProvider()
    return GeminiProvider(
        api_key=settings.gemini_api_key,
        model_name=settings.gemini_chat_model,
    )
