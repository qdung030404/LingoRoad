export interface NavItem {
  label: string;
  href: string;
}

export interface StatItem {
  id: string;
  value: string;
  label: string;
  description: string;
  badge?: string;
}

export interface FeatureItem {
  id: string;
  iconName: 'target' | 'gitBranch' | 'repeat' | 'bot' | 'award' | 'mic';
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  tag: string;
}

export interface ModelComparison {
  feature: string;
  traditional: string;
  lingoRoad: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface CatQuestionSimulation {
  id: string;
  question: string;
  cefrLevel: 'A2' | 'B1' | 'B2' | 'C1';
  thetaDifficulty: number;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}
