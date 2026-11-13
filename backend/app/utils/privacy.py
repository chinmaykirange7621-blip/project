import re


AADHAAR_RE = re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")
PAN_RE = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")
PHONE_RE = re.compile(r"(?:\+91[\s-]?)?\b[6-9]\d{9}\b")
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
SENSITIVE_KW_RE = re.compile(
    r"(?i)\b(aadhaar|aadhar|bank\s*(?:account|a/c|no|number)|ifsc|otp|password|pin)\b[\s:=-]*([A-Za-z0-9-]{3,20})?"
)


def scrub_pii(text: str) -> tuple[str, list[str]]:
    """Redact accidental Aadhaar, PAN, phone, email, or banking/OTP values before processing."""
    warnings: list[str] = []
    cleaned = text

    if AADHAAR_RE.search(cleaned):
        cleaned = AADHAAR_RE.sub("[REDACTED_AADHAAR]", cleaned)
        warnings.append("12-digit number resembling Aadhaar was automatically redacted for your privacy.")

    if PAN_RE.search(cleaned):
        cleaned = PAN_RE.sub("[REDACTED_PAN]", cleaned)
        warnings.append("PAN-like identifier was automatically redacted for your privacy.")

    if PHONE_RE.search(cleaned):
        cleaned = PHONE_RE.sub("[REDACTED_PHONE]", cleaned)
        warnings.append("Phone number was automatically redacted for your privacy.")

    if EMAIL_RE.search(cleaned):
        cleaned = EMAIL_RE.sub("[REDACTED_EMAIL]", cleaned)
        warnings.append("Email address was automatically redacted for your privacy.")

    def _redact_kw(match: re.Match) -> str:
        kw = match.group(1)
        val = match.group(2)
        if val:
            warnings.append(f"Sensitive field ({kw}) value was redacted. Never share Aadhaar, bank details, passwords, or OTPs.")
            return f"{kw} [REDACTED]"
        return match.group(0)

    cleaned = SENSITIVE_KW_RE.sub(_redact_kw, cleaned)
    return cleaned, list(dict.fromkeys(warnings))
