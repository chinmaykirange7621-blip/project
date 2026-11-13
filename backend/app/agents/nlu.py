import re
from app.schemas.chat import IntentType
from app.schemas.eligibility import StudentProfile


INDIAN_STATES: list[str] = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh",
]

STATE_SHORTCUTS: dict[str, str] = {
    "up": "Uttar Pradesh",
    "mh": "Maharashtra",
    "wb": "West Bengal",
    "ka": "Karnataka",
    "tn": "Tamil Nadu",
    "dl": "Delhi",
    "ap": "Andhra Pradesh",
    "ts": "Telangana",
    "mp": "Madhya Pradesh",
    "rj": "Rajasthan",
    "gj": "Gujarat",
    "kl": "Kerala",
}


def classify_intent(query: str) -> IntentType:
    q = query.lower().strip()

    if any(k in q for k in ("document", "documents", "certificate", "marksheet", "bonafide", "paperwork", "needed to upload")):
        return "documents"

    if any(k in q for k in ("last date", "deadline", "deadlines", "due date", "closing date", "when to apply", "apply before")):
        return "deadlines"

    if any(k in q for k in ("how do i apply", "how to apply", "application process", "apply step", "registration step", "otr", "procedure")):
        return "application_guidance"

    if any(k in q for k in ("am i eligible", "eligibility", "eligible for", "do i qualify", "can i apply", "qualify for")):
        return "eligibility"

    if any(k in q for k in ("find", "show", "list", "what scholarships", "which scholarships", "available for", "recommend", "suggest", "search")):
        # If user provides rich personal stats with "scholarships for", check if eligibility signals dominate
        if re.search(r"(\bcgpa\b|\bpercentage\b|\bincome\b|\blakh\b|\blpa\b)", q) and ("am i" in q or "eligible" in q):
            return "eligibility"
        return "discovery"

    # If user just inputs a student profile string like "B.Tech student, 8.5 CGPA, family income below 3 lakh"
    if re.search(r"(\bcgpa\b|\bpercent|\bincome\b|\blakh\b|\blpa\b)", q):
        return "eligibility"

    if any(k in q for k in ("hello", "hi ", "hey", "who are you", "what can you do", "help me")):
        return "general"

    return "discovery"


def extract_entities(query: str, base_profile: StudentProfile | None = None) -> tuple[StudentProfile, dict]:
    q = query.strip()
    q_low = q.lower()
    extracted: dict = {}

    # Course
    course_patterns: list[tuple[str, str]] = [
        (r"\bb\.?\s*tech\b", "B.Tech"),
        (r"\bb\.?\s*e\.?\b", "B.E."),
        (r"\bm\.?\s*tech\b", "M.Tech"),
        (r"\bcse\b|computer science", "CSE"),
        (r"\bai\s*&\s*ml\b|\baiml\b|artificial intelligence", "AI&ML"),
        (r"\bengineering\b|\btechnical\b", "Engineering"),
        (r"\bdiploma\b|\bpolytechnic\b", "Diploma"),
        (r"\bb\.?\s*sc\b", "B.Sc"),
        (r"\bbca\b", "BCA"),
        (r"\bb\.?\s*com\b", "B.Com"),
        (r"\bb\.?\s*a\.?\b", "B.A"),
        (r"\bmba\b", "MBA"),
        (r"\bmca\b", "MCA"),
    ]
    course = None
    for pat, label in course_patterns:
        if re.search(pat, q_low):
            if label in ("CSE", "AI&ML") and re.search(r"\bb\.?\s*tech\b", q_low):
                course = "B.Tech"
            else:
                course = label
            break
    if course:
        extracted["course"] = course

    # Education level
    education_level = None
    if re.search(r"\b(ug|undergraduate|under-graduate|bachelor|b\.?\s*tech|b\.?\s*e\.?|b\.?\s*sc|b\.?\s*com|bca)\b", q_low):
        education_level = "UG"
    elif re.search(r"\b(pg|postgraduate|post-graduate|master|m\.?\s*tech|mca|mba|m\.?\s*sc)\b", q_low):
        education_level = "PG"
    elif re.search(r"\b(diploma|polytechnic)\b", q_low):
        education_level = "Diploma"
    elif re.search(r"\b(11th|12th|class 11|class 12|higher secondary|intermediate)\b", q_low):
        education_level = "Class 11-12"
    elif re.search(r"\b(phd|ph\.d|doctoral)\b", q_low):
        education_level = "PhD"
    if education_level:
        extracted["education_level"] = education_level

    # CGPA
    cgpa = None
    m_cgpa = re.search(r"\b(\d(?:\.\d{1,2})?)\s*(?:cgpa|gpa)\b|\b(?:cgpa|gpa)\s*(?:is|of|:|=)?\s*(\d(?:\.\d{1,2})?)\b", q_low)
    if m_cgpa:
        val = float(m_cgpa.group(1) or m_cgpa.group(2))
        if 0.0 <= val <= 10.0:
            cgpa = val
            extracted["cgpa"] = cgpa

    # Percentage
    percentage = None
    m_pct = re.search(r"\b(\d{2,3}(?:\.\d{1,2})?)\s*(?:%|percent|percentage)\b", q_low)
    if m_pct:
        val = float(m_pct.group(1))
        if 0.0 <= val <= 100.0:
            percentage = val
            extracted["percentage"] = percentage

    # Family income (Indian Lakh / LPA / INR)
    family_income = None
    m_lakh = re.search(
        r"(?:below|under|less than|upto|up to|max|around|income\s*(?:is|of|:|=)?)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs|lpa)\b",
        q_low,
    )
    if m_lakh:
        family_income = round(float(m_lakh.group(1)) * 100000, 2)
    else:
        m_inr = re.search(r"(?:rs\.?|inr|₹)\s*([\d,]+)", q_low)
        if m_inr and any(w in q_low for w in ("income", "salary", "family", "earning", "annual", "below", "under")):
            raw_num = m_inr.group(1).replace(",", "")
            if raw_num.isdigit():
                family_income = float(raw_num)
        elif "low-income" in q_low or "low income" in q_low or "economically weak" in q_low:
            # Don't guess an arbitrary exact number unless stated, record qualitative hint
            extracted["income_hint"] = "low-income"
    if family_income is not None:
        extracted["family_income"] = family_income

    # State
    state = None
    for st in INDIAN_STATES:
        if st.lower() in q_low:
            state = st
            break
    if not state:
        for abbr, full in STATE_SHORTCUTS.items():
            if re.search(rf"\bfrom\s+{abbr}\b|\bstate\s+{abbr}\b", q_low):
                state = full
                break
    if state:
        extracted["state"] = state

    # Category
    category = None
    if re.search(r"\bpwd\b|specially[\s-]abled|differently[\s-]abled|disability", q_low):
        category = "PwD"
    elif re.search(r"\bminority|minorities|muslim|christian|sikh|buddhist|jain|parsi\b", q_low):
        category = "Minority"
    elif re.search(r"\bsc\b|scheduled caste", q_low):
        category = "SC"
    elif re.search(r"\bst\b|scheduled tribe", q_low):
        category = "ST"
    elif re.search(r"\bobc\b|other backward", q_low):
        category = "OBC"
    elif re.search(r"\bews\b|economically weaker", q_low):
        category = "EWS"
    elif re.search(r"\bgeneral\b|\bur\b|unreserved", q_low):
        category = "General"
    if category:
        extracted["category"] = category

    # Gender
    gender = None
    if re.search(r"\b(girl|girls|female|woman|women)\b", q_low):
        gender = "Female"
    elif re.search(r"\b(boy|boys|male|man)\b", q_low):
        gender = "Male"
    if gender:
        extracted["gender"] = gender

    # Merge with existing non-identifying profile context (new values override)
    merged = StudentProfile(
        education_level=education_level or (base_profile.education_level if base_profile else None),
        course=course or (base_profile.course if base_profile else None),
        percentage=percentage if percentage is not None else (base_profile.percentage if base_profile else None),
        cgpa=cgpa if cgpa is not None else (base_profile.cgpa if base_profile else None),
        family_income=family_income if family_income is not None else (base_profile.family_income if base_profile else None),
        state=state or (base_profile.state if base_profile else None),
        category=category or (base_profile.category if base_profile else None),
        gender=gender or (base_profile.gender if base_profile else None),
    )

    return merged, extracted
