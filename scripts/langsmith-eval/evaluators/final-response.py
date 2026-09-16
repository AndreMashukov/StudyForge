def canned_fallback_evaluator(run, example):
    outputs = run.outputs if hasattr(run, "outputs") else run.get("outputs", {}) or {}
    example_outputs = (
        example.outputs
        if hasattr(example, "outputs")
        else example.get("outputs", {}) or {}
    )
    reply = outputs.get("finalReply") if isinstance(outputs, dict) else ""
    if not isinstance(reply, str):
        reply = ""
    banned = example_outputs.get("mustNotContain") if isinstance(example_outputs, dict) else None
    if not isinstance(banned, str) or not banned.strip():
        banned = "I completed the planned steps but could not compose a final reply."
    hit = banned in reply
    return {
        "score": 0 if hit else 1,
        "comment": "Reply contains canned planner fallback" if hit else "No canned planner fallback",
    }


def nonempty_reply_evaluator(run, example):
    outputs = run.outputs if hasattr(run, "outputs") else run.get("outputs", {}) or {}
    reply = outputs.get("finalReply") if isinstance(outputs, dict) else ""
    if not isinstance(reply, str):
        reply = ""
    trimmed = reply.strip()
    return {
        "score": 1 if trimmed else 0,
        "comment": f"Reply length {len(trimmed)}" if trimmed else "finalReply is missing or empty",
    }
