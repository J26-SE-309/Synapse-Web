"""Project keys: the short prefix of a project's story and sprint ids (MFP-12, MFP-S5), like a Jira project key."""

import re

KEY_PATTERN = r"^[A-Z][A-Z0-9]{1,4}$"
KEY_MAX = 5


def suggest(name: str, taken: set[str]) -> str:
    """A free key from the name's initials (My First Project -> MFP); one word gives its first letters (Tutoring ->
    TUT); a number is added when the key is taken (MFP2)."""
    words = re.findall(r"[A-Za-z][A-Za-z0-9]*", name)
    initials = "".join(word[0] for word in words).upper()
    if len(initials) < 2:
        initials = (words[0][:3] if words else "PRJ").upper()
    base = initials[:KEY_MAX]
    if len(base) < 2:
        base = (base + "X")[:2]
    if base not in taken:
        return base
    for number in range(2, 1000):
        candidate = f"{base[:KEY_MAX - len(str(number))]}{number}"
        if candidate not in taken:
            return candidate
    raise ValueError("no free key")
