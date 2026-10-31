
import math
import ipaddress
from collections import Counter
from urllib.parse import urlsplit

FEATURE_NAMES = [
    "url_length", "hostname_length", "path_length",
    "query_length", "dot_count", "hyphen_count",
    "underscore_count", "slash_count", "digit_count",
    "at_count", "question_count", "equal_count",
    "ampersand_count", "subdomain_count",
    "has_ip", "uses_https", "has_port",
    "suspicious_word_count", "hostname_entropy",
    "path_depth"
]

SUSPICIOUS_WORDS = (
    "login", "verify", "account", "secure", "update",
    "password", "signin", "banking", "confirm",
    "wallet", "credential", "recover"
)


def entropy(text):
    if not text:
        return 0.0

    counts = Counter(text)
    length = len(text)

    return -sum(
        (count / length) * math.log2(count / length)
        for count in counts.values()
    )


def featureExtraction(url):
    if not isinstance(url, str):
        raise ValueError("URL must be a string")

    url = url.strip()

    if not url:
        raise ValueError("URL cannot be empty")

    if "://" not in url:
        url = "https://" + url

    parsed = urlsplit(url)
    hostname = (parsed.hostname or "").lower()

    if not hostname:
        raise ValueError("Invalid URL")

    # Normalize www prefix for feature extraction
    if hostname.startswith("www."):
        hostname = hostname[4:]

    # Normalize homepage trailing slash
    if (
        parsed.path in ("", "/")
        and not parsed.query
        and not parsed.fragment
        and parsed.port is None
        and parsed.username is None
    ):
        url = f"{parsed.scheme.lower()}://{hostname}"
        parsed = urlsplit(url)

    path = parsed.path or ""
    query = parsed.query or ""

    try:
        ipaddress.ip_address(hostname)
        has_ip = 1
    except ValueError:
        has_ip = 0

    try:
        has_port = int(parsed.port is not None)
    except ValueError:
        has_port = 1

    subdomain_count = max(
        0, len(hostname.split(".")) - 2
    )

    suspicious_word_count = sum(
        word in url.lower()
        for word in SUSPICIOUS_WORDS
    )

    features = [
        len(url),
        len(hostname),
        len(path),
        len(query),
        url.count("."),
        url.count("-"),
        url.count("_"),
        url.count("/"),
        sum(c.isdigit() for c in url),
        url.count("@"),
        url.count("?"),
        url.count("="),
        url.count("&"),
        subdomain_count,
        has_ip,
        int(parsed.scheme.lower() == "https"),
        has_port,
        suspicious_word_count,
        entropy(hostname),
        len([p for p in path.split("/") if p])
    ]

    return features
