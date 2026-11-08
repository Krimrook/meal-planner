// Shared "which keyword does this ingredient name match?" helpers.
// Day 9's guessAisle() had these inline; Day 10's price lookup needs exactly
// the same matching rules, so they live here now and both import them.

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Matches a whole word, with an optional plural ending, so "egg" matches
// "eggs" and "tomato" matches "tomatoes" — but "ham" doesn't match "shame".
export function wordPattern(word) {
  return new RegExp(`\\b${escapeRegExp(word)}(s|es)?\\b`);
}

// Takes a list of { keyword, ...anything } objects and returns them with a
// compiled `pattern`, sorted longest keyword first. Because it's
// longest-first, the first match found is always the most specific one
// ("coconut milk" is checked before "milk").
export function buildKeywordIndex(items) {
  return items
    .map((item) => ({ ...item, pattern: wordPattern(item.keyword) }))
    .sort((a, b) => b.keyword.length - a.keyword.length);
}

// First (= most specific) index entry whose keyword appears in `name`, or null.
export function findKeyword(index, rawName) {
  const name = (rawName || '').toLowerCase();
  return index.find((entry) => entry.pattern.test(name)) ?? null;
}
