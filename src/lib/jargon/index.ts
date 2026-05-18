import jargonDictionaryJson from "./jargon-dictionary.json";

export type JargonDictionary = Record<string, string>;

export const jargonDictionary: JargonDictionary = jargonDictionaryJson as JargonDictionary;
