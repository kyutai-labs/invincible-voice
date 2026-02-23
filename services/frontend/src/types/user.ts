export interface Document {
  title: string;
  content: string;
}

export interface UserSettings {
  name: string;
  prompt: string;
  additional_keywords: string[];
  friends: string[];
  documents: Document[];
  voice: string | null;
  expected_transcription_language: string | null;
  accepted_terms_of_services: boolean;
}

export interface UserData {
  email: string;
  user_settings: UserSettings;
}
