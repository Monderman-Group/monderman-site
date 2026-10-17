#!/usr/bin/env python3
"""Render only the two approved Hiring and Work Design publication cards."""

from generate_publication_social_cards import Card, render


CARDS = (
    Card(
        "hiring-blind-spot", "Insight", "Hiring and Work Design · Part 1",
        "The Hiring Blind Spot",
        "The more exactly a company describes the person it wants, the less it can tell whether it got one.",
        "October 16, 2026", ("The Hiring", "Blind Spot"),
    ),
    Card(
        "posting-has-outgrown-the-job", "Insight", "Hiring and Work Design · Part 2",
        "The Posting Has Outgrown the Job",
        "Every hire fills a hole. The posting has stopped describing it.",
        "October 16, 2026", ("The Posting Has", "Outgrown the Job"),
    ),
)


if __name__ == "__main__":
    for card in CARDS:
        print(render(card))
