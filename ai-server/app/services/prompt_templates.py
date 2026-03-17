"""
Prompt templates for the qwen2:1.5b language model.

All prompts are kept here so they can be tuned in one place without
touching route or service code.  Each builder returns a plain string
or a list[dict] ready for the Ollama /api/chat endpoint.
"""

from __future__ import annotations


# ── System prompts ──────────────────────────────────────────

SLIDE_QA_SYSTEM = (
    "You are a precise AI assistant that explains presentation slides. "
    "RULES:\n"
    "1. Answer ONLY from the slide context provided below.\n"
    "2. If the answer is not in the slides, reply: "
    "\"This information is not covered in the slides.\"\n"
    "3. Reference slide numbers when possible (e.g. \"As shown in Slide 3…\").\n"
    "4. Keep answers concise — aim for 2-4 sentences unless asked to elaborate.\n"
    "5. Use Markdown formatting (bold, lists, code blocks) for readability."
)

SUMMARIZE_SYSTEM = (
    "You are an expert summarizer. You produce clear, structured summaries "
    "of presentation decks. Follow this format:\n"
    "1. **Main Topic** — one sentence describing the presentation.\n"
    "2. **Key Points** — bullet list of the most important points.\n"
    "3. **Conclusions** — any takeaways or action items.\n"
    "Use Markdown formatting."
)

DETAILED_SUMMARIZE_SYSTEM = (
    "You are an expert educational content analyser. "
    "Given the slide content below, produce THREE clearly separated sections "
    "using EXACTLY these Markdown headings:\n\n"
    "## Short Summary\n"
    "Write a concise 2-3 sentence overview of the entire presentation.\n\n"
    "## Detailed Explanation\n"
    "Provide a thorough, paragraph-form explanation of each major topic "
    "covered in the slides. Reference slide numbers where relevant.\n\n"
    "## Revision Notes\n"
    "List the most important facts and concepts as bullet points (use - ) "
    "that a student should memorise for an exam.\n\n"
    "RULES:\n"
    "- Base your answer ONLY on the provided slide content.\n"
    "- If a section cannot be generated, write \"Not enough content.\"\n"
    "- Use Markdown formatting throughout."
)

MCQ_SYSTEM = (
    "You are an expert quiz generator for educational content. "
    "Given slide content, generate exactly 5 multiple-choice questions.\n\n"
    "You MUST respond with valid JSON only — no explanation, no markdown fences.\n"
    "Use this EXACT structure:\n"
    '[{\"question\": \"...\", \"options\": [\"A. ...\", \"B. ...\", \"C. ...\", \"D. ...\"], '
    '\"correct_answer\": \"A\"}]\n\n'
    "RULES:\n"
    "1. Each question must have EXACTLY 4 options labelled A, B, C, D.\n"
    "2. The correct_answer field must be only the letter (A, B, C, or D).\n"
    "3. Questions should test understanding, not just recall.\n"
    "4. Base questions ONLY on the provided slide content.\n"
    "5. Return ONLY the JSON array — nothing else."
)

EXPLAIN_SLIDE_SYSTEM = (
    "You are a teaching assistant. Explain the content of the given slide "
    "in simple terms as if teaching a student. Be concise and use examples "
    "where appropriate. Format your response in Markdown."
)


# ── Message builders ────────────────────────────────────────

def build_qa_messages(
    question: str,
    context_chunks: list[dict],
    chat_history: list[dict] | None = None,
) -> list[dict]:
    """
    Build the message list for a slide Q&A /chat call.

    Args:
        question:       The user's natural-language question.
        context_chunks: Results from EmbeddingService.search() (text + metadata).
        chat_history:   Optional list of prior {role, content} messages.

    Returns:
        A list of {role, content} dicts ready for OllamaService.chat().
    """
    context_text = _format_context(context_chunks)

    system_content = (
        f"{SLIDE_QA_SYSTEM}\n\n"
        f"### Relevant Slide Context:\n{context_text}"
    )

    messages: list[dict] = [{"role": "system", "content": system_content}]

    # Inject recent conversation turns (capped for context window)
    if chat_history:
        for msg in chat_history[-6:]:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })

    messages.append({"role": "user", "content": question})
    return messages


def build_summarize_prompt(context_chunks: list[dict]) -> str:
    """
    Build a single prompt for the /summarize generate call.
    """
    context_text = _format_context(context_chunks)

    return (
        f"{SUMMARIZE_SYSTEM}\n\n"
        f"### Slide Content:\n{context_text}\n\n"
        "Produce the summary now."
    )


def build_detailed_summarize_prompt(context_chunks: list[dict]) -> str:
    """
    Build a prompt that produces three sections:
    short summary, detailed explanation, and revision notes.
    """
    context_text = _format_context(context_chunks)

    return (
        f"{DETAILED_SUMMARIZE_SYSTEM}\n\n"
        f"### Slide Content:\n{context_text}\n\n"
        "Generate the three sections now."
    )


def build_mcq_prompt(context_chunks: list[dict]) -> str:
    """
    Build a prompt that generates 5 MCQs as a JSON array.
    """
    context_text = _format_context(context_chunks)

    return (
        f"{MCQ_SYSTEM}\n\n"
        f"### Slide Content:\n{context_text}\n\n"
        "Generate the 5 MCQ questions now as a JSON array."
    )


def build_explain_messages(
    slide_number: int,
    slide_text: str,
) -> list[dict]:
    """
    Build messages for explaining a single slide in plain language.
    """
    return [
        {"role": "system", "content": EXPLAIN_SLIDE_SYSTEM},
        {
            "role": "user",
            "content": (
                f"Explain this slide (Slide {slide_number}) in simple terms:\n\n"
                f"{slide_text}"
            ),
        },
    ]


# ── Helpers ─────────────────────────────────────────────────

def _format_context(chunks: list[dict]) -> str:
    """
    Render retrieved chunks into a readable context block.
    """
    if not chunks:
        return "No slide content is available."

    parts: list[str] = []
    for chunk in chunks:
        meta = chunk.get("metadata", {})
        slide_num = meta.get("slide_number", "?")
        heading = meta.get("heading", "")
        label = f"Slide {slide_num}"
        if heading:
            label += f" — {heading}"
        parts.append(f"[{label}]:\n{chunk['text']}")

    return "\n\n".join(parts)
