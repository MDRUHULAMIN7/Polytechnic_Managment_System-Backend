import { AcademicDepartment } from '../academicDepartment/academicDepartment.model.js';
import { AcademicSemester } from '../academicSemester/academicSemesterModel.js';
import { createOpenRouterChatCompletion } from '../../helper/openRouter.js';
import { Instructor } from '../Instructor/Instructor.model.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import AppError from '../../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../../utils/logger.js';
import type {
  TChatbotIntent,
  TChatbotMessage,
  TChatbotReply,
} from './chatbot.interface.js';

const DEFAULT_SUGGESTIONS = [
  'কোন কোন department আছে?',
  'এখন কোন semester registration চলছে?',
  'Instructor কারা আছেন?',
  'Computer related পড়তে চাই, কোন department ভালো?',
];

const CHAT_HISTORY_LIMIT = 8;
const CHATBOT_BLOCKED_HINTS = [
  'ignore previous instructions',
  'system prompt',
  'reveal prompt',
  'api key',
  'exploit',
  'bypass',
  'malware',
  'bomb',
  'hack',
];

const DEPARTMENT_RECOMMENDATION_HINTS = [
  'which department',
  'kon department',
  'department enroll',
  'enroll kora uchit',
  'vorti',
  'ভর্তি',
  'admission',
  'department ভালো',
  'pora uchit',
  'পড়া উচিত',
];

const DEPARTMENT_LIST_HINTS = [
  'department',
  'dept',
  'বিভাগ',
  'বিভাগগুলো',
  'departments',
];

const SEMESTER_HINTS = [
  'semester',
  'semister',
  'সেমিস্টার',
];

const CURRENT_HINTS = [
  'current',
  'ongoing',
  'running',
  'now',
  'akhon',
  'ekhon',
  'এখন',
  'cholse',
  'cholche',
  'choltese',
  'চলছে',
  'চলতেছে',
];

const REGISTRATION_HINTS = [
  'registration',
  'register',
  'enrollment',
  'enroll',
  'ভর্তি',
  'registration চলছে',
  'registration cholse',
];

const INSTRUCTOR_HINTS = [
  'instructor',
  'teacher',
  'faculty',
  'sir',
  'madam',
  'শিক্ষক',
  'teacherরা',
];

type TInterestProfile = {
  key: string;
  interestKeywords: string[];
  departmentKeywords: string[];
  guidance: string;
};

const INTEREST_PROFILES: TInterestProfile[] = [
  {
    key: 'computer',
    interestKeywords: [
      'computer',
      'software',
      'programming',
      'coding',
      'code',
      'web',
      'app',
      'ai',
      'ict',
      'it',
    ],
    departmentKeywords: ['computer', 'software', 'ict', 'it', 'cse'],
    guidance:
      'Programming, software, web, app বা IT-based career চাইলে এই track সবচেয়ে relevant হয়.',
  },
  {
    key: 'electrical',
    interestKeywords: ['electrical', 'electric', 'power', 'circuit', 'substation'],
    departmentKeywords: ['electrical', 'power'],
    guidance:
      'Power systems, electrical maintenance, industry automation বা circuit-based work ভালো লাগলে এই track মানায়.',
  },
  {
    key: 'electronics',
    interestKeywords: ['electronics', 'electronic', 'embedded', 'hardware', 'device'],
    departmentKeywords: ['electronics', 'electronic'],
    guidance:
      'Hardware, embedded systems, devices বা electronics troubleshooting পছন্দ হলে এই track ভালো match হতে পারে.',
  },
  {
    key: 'civil',
    interestKeywords: ['civil', 'construction', 'building', 'road', 'structure'],
    departmentKeywords: ['civil'],
    guidance:
      'Construction, building design support, road/structure related field চাইলে Civil-type department ভালো fit হয়.',
  },
  {
    key: 'mechanical',
    interestKeywords: ['mechanical', 'machine', 'automobile', 'manufacturing'],
    departmentKeywords: ['mechanical', 'automobile'],
    guidance:
      'Machines, manufacturing, workshop বা industrial maintenance পছন্দ হলে Mechanical-type department strong option.',
  },
  {
    key: 'textile',
    interestKeywords: ['textile', 'garments', 'fashion', 'fabric'],
    departmentKeywords: ['textile', 'garments'],
    guidance:
      'Garments, production line, textile processing বা apparel sector এ যেতে চাইলে এই track useful.',
  },
];

type TDepartmentSummary = {
  name: string;
  academicInstructorName: string | null;
};

type TInstructorSummary = {
  fullName: string;
  designation: string;
  departmentName: string | null;
};

type TSemesterRegistrationSummary = {
  semesterName: string;
  semesterCode: string;
  year: string;
  shift: string;
  status: string;
  startDate: Date;
  endDate: Date;
};

type TAiReplyPayload = {
  answer?: string;
  suggestions?: string[];
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);

const formatPersonName = (name?: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
}) =>
  [name?.firstName, name?.middleName, name?.lastName].filter(Boolean).join(' ');

const includesAny = (source: string, keywords: string[]) =>
  keywords.some((keyword) => source.includes(keyword));

const containsBlockedPrompt = (question: string) => {
  const normalizedQuestion = normalizeText(question);
  return CHATBOT_BLOCKED_HINTS.some((keyword) =>
    normalizedQuestion.includes(normalizeText(keyword)),
  );
};

const sanitizeSuggestions = (value: unknown) => {
  if (!Array.isArray(value)) {
    return DEFAULT_SUGGESTIONS;
  }

  const suggestions = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  return suggestions.length ? suggestions : DEFAULT_SUGGESTIONS;
};

const extractJsonPayload = (value: string): TAiReplyPayload | null => {
  const normalizedValue = value.trim();

  try {
    return JSON.parse(normalizedValue) as TAiReplyPayload;
  } catch {
    const matchedObject = normalizedValue.match(/\{[\s\S]*\}/);

    if (!matchedObject) {
      return null;
    }

    try {
      return JSON.parse(matchedObject[0]) as TAiReplyPayload;
    } catch {
      return null;
    }
  }
};

const getDepartmentSummaries = async (): Promise<TDepartmentSummary[]> => {
  const departmentDocs = await AcademicDepartment.find()
    .populate('academicInstructor', 'name')
    .sort({ name: 1 });

  return departmentDocs.map((departmentDoc) => {
    const populatedInstructor = departmentDoc.academicInstructor as
      | { name?: string }
      | null
      | undefined;

    return {
      name: departmentDoc.name,
      academicInstructorName: populatedInstructor?.name ?? null,
    };
  });
};

const getInstructorSummaries = async (): Promise<TInstructorSummary[]> => {
  const instructorDocs = await Instructor.find()
    .select('name designation academicDepartment')
    .populate('academicDepartment', 'name')
    .sort({ 'name.firstName': 1, 'name.lastName': 1 });

  return instructorDocs.map((instructorDoc) => {
    const populatedDepartment = instructorDoc.academicDepartment as
      | { name?: string }
      | null
      | undefined;

    return {
      fullName: formatPersonName(instructorDoc.name),
      designation: instructorDoc.designation,
      departmentName: populatedDepartment?.name ?? null,
    };
  });
};

const getSemesterRegistrationSummaries = async (
  statuses?: string[],
): Promise<TSemesterRegistrationSummary[]> => {
  const query = statuses?.length ? { status: { $in: statuses } } : {};

  const registrationDocs = await SemesterRegistration.find(query)
    .populate('academicSemester')
    .sort({ startDate: 1 });

  return registrationDocs.flatMap((registrationDoc) => {
    const academicSemester = registrationDoc.academicSemester as
      | {
          name?: string;
          code?: string;
          year?: string;
        }
      | null
      | undefined;

    if (!academicSemester?.name || !academicSemester?.year || !academicSemester?.code) {
      return [];
    }

    return [
      {
        semesterName: academicSemester.name,
        semesterCode: academicSemester.code,
        year: academicSemester.year,
        shift: registrationDoc.shift,
        status: registrationDoc.status,
        startDate: registrationDoc.startDate,
        endDate: registrationDoc.endDate,
      },
    ];
  });
};

const getAcademicSemesterList = async () => {
  const semesterDocs = await AcademicSemester.find().sort({ year: -1, code: 1 });

  return semesterDocs.map((semesterDoc) => ({
    name: semesterDoc.name,
    code: semesterDoc.code,
    year: semesterDoc.year,
    startMonth: semesterDoc.startMonth,
    endMonth: semesterDoc.endMonth,
  }));
};

const buildCampusContext = async () => {
  const [departments, instructors, registrations, semesters] = await Promise.all([
    getDepartmentSummaries(),
    getInstructorSummaries(),
    getSemesterRegistrationSummaries(['ONGOING', 'UPCOMING']),
    getAcademicSemesterList(),
  ]);

  return {
    departmentCount: departments.length,
    departments,
    instructorCount: instructors.length,
    instructorPreview: instructors.slice(0, 30),
    activeSemesterRegistrations: registrations.map((registration) => ({
      ...registration,
      startDate: registration.startDate.toISOString(),
      endDate: registration.endDate.toISOString(),
    })),
    academicSemesterPreview: semesters.slice(0, 16),
    recommendationProfiles: INTEREST_PROFILES.map((profile) => ({
      focus: profile.key,
      departmentKeywords: profile.departmentKeywords,
      guidance: profile.guidance,
    })),
  };
};

const buildAiReply = async (
  question: string,
  messages: TChatbotMessage[],
): Promise<TChatbotReply> => {
  const campusContext = await buildCampusContext();
  const recentMessages = messages.slice(-CHAT_HISTORY_LIMIT).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const completion = await createOpenRouterChatCompletion(
    [
      {
        role: 'system',
        content: `You are the public-facing AI assistant for a Polytechnic Management System.
Answer in the same language and tone the user is using.
If the user writes in Banglish, reply naturally in Banglish or a light Bangla-English mix.
If the user writes in Bangla, reply in Bangla.
If the user writes in English, reply in English.
Do not sound robotic or overly formal.
Be helpful, conversational, and practical.
Use only the supplied campus context. Do not invent departments, semesters, instructors, dates, or policies.
If data is missing, say that clearly and offer the next best help.
For department recommendation questions, use the recommendation profiles plus available department names. If the user's interest is unclear, ask one short clarifying question inside the answer.

Always structure the main reply clearly inside the "answer" field using simple markdown with sections:
- Start with a short title line summarizing the answer.
- Then a **Quick answer** section with 2–4 bullet points (most important facts first).
- Then a **Details** section with concise bullets or short paragraphs.
- When giving guidance or steps, add a **What you can do next** section with 2–4 specific actions.

Keep sentences short and scannable. Use bullet points instead of long paragraphs whenever possible.

Return only valid JSON with this exact shape:
{"answer":"string (markdown)","suggestions":["string","string","string"]}`,
      },
      {
        role: 'system',
        content: `Campus context JSON:\n${JSON.stringify(campusContext)}`,
      },
      ...recentMessages,
      {
        role: 'user',
        content: question,
      },
    ],
    {
      temperature: 0.25,
      maxTokens: 700,
    },
  );

  const parsedPayload = extractJsonPayload(completion.content);

  if (parsedPayload?.answer?.trim()) {
    return {
      question,
      answer: parsedPayload.answer.trim(),
      matchedIntent: 'ai',
      suggestions: sanitizeSuggestions(parsedPayload.suggestions),
      source: 'ai',
    };
  }

  return {
    question,
    answer: completion.content.trim(),
    matchedIntent: 'ai',
    suggestions: DEFAULT_SUGGESTIONS,
    source: 'ai',
  };
};

const detectIntent = (question: string): TChatbotIntent => {
  const normalizedQuestion = normalizeText(question);

  if (
    includesAny(normalizedQuestion, DEPARTMENT_RECOMMENDATION_HINTS) ||
    (normalizedQuestion.includes('department') &&
      (normalizedQuestion.includes('which') ||
        normalizedQuestion.includes('kon') ||
        normalizedQuestion.includes('কি') ||
        normalizedQuestion.includes('ki')))
  ) {
    return 'department_recommendation';
  }

  if (includesAny(normalizedQuestion, INSTRUCTOR_HINTS)) {
    return 'instructor_list';
  }

  if (
    includesAny(normalizedQuestion, SEMESTER_HINTS) &&
    includesAny(normalizedQuestion, REGISTRATION_HINTS)
  ) {
    return 'semester_registration';
  }

  if (
    includesAny(normalizedQuestion, SEMESTER_HINTS) &&
    includesAny(normalizedQuestion, CURRENT_HINTS)
  ) {
    return 'semester_current';
  }

  if (includesAny(normalizedQuestion, SEMESTER_HINTS)) {
    return 'semester_list';
  }

  if (includesAny(normalizedQuestion, DEPARTMENT_LIST_HINTS)) {
    return 'department_list';
  }

  return 'fallback';
};

const matchDepartmentByName = (
  question: string,
  departments: TDepartmentSummary[],
) => {
  const normalizedQuestion = normalizeText(question);

  return (
    departments.find((department) =>
      normalizedQuestion.includes(normalizeText(department.name)),
    ) ?? null
  );
};

const getMatchedInterestProfile = (question: string): TInterestProfile | null => {
  const normalizedQuestion = normalizeText(question);

  let bestMatch: TInterestProfile | null = null;
  let highestScore = 0;

  for (const profile of INTEREST_PROFILES) {
    const score = profile.interestKeywords.reduce((total, keyword) => {
      return total + Number(normalizedQuestion.includes(keyword));
    }, 0);

    if (score > highestScore) {
      highestScore = score;
      bestMatch = profile;
    }
  }

  if (highestScore === 0) {
    return null;
  }

  return bestMatch;
};

const buildDepartmentListReply = async (question: string): Promise<TChatbotReply> => {
  const departments = await getDepartmentSummaries();

  if (!departments.length) {
    return {
      question,
      matchedIntent: 'department_list',
      answer:
        'এখনও PMS-এ কোনো academic department data যোগ করা নেই। Admin panel থেকে department add করলে আমি list দেখাতে পারব।',
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const departmentLines = departments.map((department) => {
    if (!department.academicInstructorName) {
      return department.name;
    }

    return `${department.name} (Academic instructor: ${department.academicInstructorName})`;
  });

  return {
    question,
    matchedIntent: 'department_list',
    answer: `বর্তমানে ${departments.length}টি department আছে: ${departmentLines.join(', ')}.`,
    suggestions: [
      'আমার জন্য কোন department ভালো হবে?',
      'এখন কোন semester চলছে?',
      'Instructor কারা আছেন?',
    ],
  };
};

const buildDepartmentRecommendationReply = async (
  question: string,
): Promise<TChatbotReply> => {
  const departments = await getDepartmentSummaries();

  if (!departments.length) {
    return {
      question,
      matchedIntent: 'department_recommendation',
      answer:
        'Department recommendation দিতে department data দরকার, কিন্তু এখন PMS-এ কোনো department configure করা নেই।',
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const explicitDepartment = matchDepartmentByName(question, departments);

  if (explicitDepartment) {
    const instructorLine = explicitDepartment.academicInstructorName
      ? ` এই department-এর academic instructor হলেন ${explicitDepartment.academicInstructorName}.`
      : '';

    return {
      question,
      matchedIntent: 'department_recommendation',
      answer: `${explicitDepartment.name} department আপনার প্রশ্নে directly mention করা হয়েছে। যদি এই field-এর কাজ, subject focus বা career path নিয়ে আগ্রহ থাকে, এই department consider করতে পারেন.${instructorLine}`,
      suggestions: [
        'এই department-এর instructor কারা?',
        'আর কোন কোন department আছে?',
        'এখন কোন semester registration চলছে?',
      ],
    };
  }

  const matchedProfile = getMatchedInterestProfile(question);

  if (matchedProfile) {
    const recommendedDepartments = departments.filter((department) => {
      const normalizedDepartmentName = normalizeText(department.name);

      return matchedProfile.departmentKeywords.some((keyword) =>
        normalizedDepartmentName.includes(keyword),
      );
    });

    if (recommendedDepartments.length) {
      const recommendedNames = recommendedDepartments
        .slice(0, 3)
        .map((department) => department.name)
        .join(', ');

      return {
        question,
        matchedIntent: 'department_recommendation',
        answer: `আপনার interest অনুযায়ী ${recommendedNames} সবচেয়ে relevant মনে হচ্ছে। ${matchedProfile.guidance}`,
        suggestions: [
          'আর কোন কোন department আছে?',
          'Instructor কারা আছেন?',
          'এখন কোন semester চলছে?',
        ],
      };
    }
  }

  const departmentNames = departments.map((department) => department.name).join(', ');

  return {
    question,
    matchedIntent: 'department_recommendation',
    answer: `কোন department enrol করা উচিত সেটা আপনার interest-এর উপর depend করে। Programming বা software ভালো লাগলে Computer-type department, power বা circuit পছন্দ হলে Electrical/Electronics-type department, আর construction পছন্দ হলে Civil-type department consider করা উচিত। বর্তমানে available departments: ${departmentNames}.`,
    suggestions: [
      'Computer related পড়তে চাই, কোন department ভালো?',
      'Electrical related পড়তে চাই, কোন department ভালো?',
      'কোন কোন department আছে?',
    ],
  };
};

const buildCurrentSemesterReply = async (question: string): Promise<TChatbotReply> => {
  const ongoingRegistrations = await getSemesterRegistrationSummaries(['ONGOING']);

  if (ongoingRegistrations.length) {
    const lines = ongoingRegistrations.map(
      (registration) =>
        `${registration.shift} shift: ${registration.semesterName} Semester (${registration.semesterCode}) ${registration.year}, ${formatDate(registration.startDate)} থেকে ${formatDate(registration.endDate)}`,
    );

    return {
      question,
      matchedIntent: 'semester_current',
      answer: `এখন ${ongoingRegistrations.length}টি ongoing semester registration আছে: ${lines.join('; ')}.`,
      suggestions: [
        'পরের semester registration কোনটা?',
        'কোন কোন department আছে?',
        'Instructor কারা আছেন?',
      ],
    };
  }

  const upcomingRegistrations = await getSemesterRegistrationSummaries(['UPCOMING']);

  if (upcomingRegistrations.length) {
    const nextRegistration = upcomingRegistrations[0];

    return {
      question,
      matchedIntent: 'semester_current',
      answer: `এই মুহূর্তে কোনো semester registration ONGOING নেই। সবচেয়ে কাছের upcoming registration হলো ${nextRegistration.shift} shift-এর ${nextRegistration.semesterName} Semester (${nextRegistration.semesterCode}) ${nextRegistration.year}, ${formatDate(nextRegistration.startDate)} থেকে ${formatDate(nextRegistration.endDate)}.`,
      suggestions: [
        'সব semester registration দেখাও',
        'কোন কোন department আছে?',
        'আমার জন্য কোন department ভালো হবে?',
      ],
    };
  }

  return {
    question,
    matchedIntent: 'semester_current',
    answer:
      'এখন PMS-এ কোনো ongoing বা upcoming semester registration data পাওয়া যায়নি।',
    suggestions: DEFAULT_SUGGESTIONS,
  };
};

const buildSemesterRegistrationReply = async (
  question: string,
): Promise<TChatbotReply> => {
  const registrations = await getSemesterRegistrationSummaries(['ONGOING', 'UPCOMING']);

  if (!registrations.length) {
    return {
      question,
      matchedIntent: 'semester_registration',
      answer:
        'এখন PMS-এ কোনো ongoing বা upcoming semester registration configure করা নেই।',
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const lines = registrations.map(
    (registration) =>
      `${registration.status}: ${registration.shift} shift-এর ${registration.semesterName} Semester (${registration.semesterCode}) ${registration.year}, ${formatDate(registration.startDate)} থেকে ${formatDate(registration.endDate)}`,
  );

  return {
    question,
    matchedIntent: 'semester_registration',
    answer: `বর্তমান semester registration summary: ${lines.join('; ')}.`,
    suggestions: [
      'এখন কোন semester চলছে?',
      'কোন কোন department আছে?',
      'Instructor কারা আছেন?',
    ],
  };
};

const buildSemesterListReply = async (question: string): Promise<TChatbotReply> => {
  const semesters = await getAcademicSemesterList();

  if (!semesters.length) {
    return {
      question,
      matchedIntent: 'semester_list',
      answer: 'PMS-এ এখনো কোনো academic semester data যোগ করা নেই।',
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const lines = semesters.map(
    (semester) =>
      `${semester.name} Semester (${semester.code}) ${semester.year}: ${semester.startMonth} - ${semester.endMonth}`,
  );

  return {
    question,
    matchedIntent: 'semester_list',
    answer: `Configured academic semesters: ${lines.join('; ')}.`,
    suggestions: [
      'এখন কোন semester চলছে?',
      'কোন কোন department আছে?',
      'Instructor কারা আছেন?',
    ],
  };
};

const buildInstructorReply = async (question: string): Promise<TChatbotReply> => {
  const [departments, instructors] = await Promise.all([
    getDepartmentSummaries(),
    getInstructorSummaries(),
  ]);

  if (!instructors.length) {
    return {
      question,
      matchedIntent: 'instructor_list',
      answer: 'এখন PMS-এ কোনো instructor data পাওয়া যায়নি।',
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const matchedDepartment = matchDepartmentByName(question, departments);

  const filteredInstructors = matchedDepartment
    ? instructors.filter(
        (instructor) => instructor.departmentName === matchedDepartment.name,
      )
    : instructors;

  if (matchedDepartment && !filteredInstructors.length) {
    return {
      question,
      matchedIntent: 'instructor_list',
      answer: `${matchedDepartment.name} department-এর জন্য এখন কোনো instructor record পাওয়া যায়নি।`,
      suggestions: [
        'আর কোন কোন department আছে?',
        'এখন কোন semester চলছে?',
        'সব instructor দেখাও',
      ],
    };
  }

  const listedInstructors = filteredInstructors
    .slice(0, 12)
    .map((instructor) => {
      const departmentLabel = instructor.departmentName
        ? `, ${instructor.departmentName}`
        : '';

      return `${instructor.fullName} (${instructor.designation}${departmentLabel})`;
    });

  const remainingCount = filteredInstructors.length - listedInstructors.length;
  const remainingLine =
    remainingCount > 0 ? ` আরও ${remainingCount} জন আছেন.` : '';
  const prefix = matchedDepartment
    ? `${matchedDepartment.name} department-এর instructors: `
    : `বর্তমানে ${filteredInstructors.length} জন instructor আছেন: `;

  return {
    question,
    matchedIntent: 'instructor_list',
    answer: `${prefix}${listedInstructors.join(', ')}.${remainingLine}`,
    suggestions: [
      'কোন কোন department আছে?',
      'এখন কোন semester registration চলছে?',
      'আমার জন্য কোন department ভালো হবে?',
    ],
  };
};

const buildRuleBasedFallbackReply = async (
  question: string,
): Promise<TChatbotReply> => {
  return {
    question,
    matchedIntent: 'fallback',
    answer:
      'আমি department, semester, registration আর instructor related common প্রশ্নের উত্তর দিতে পারি। উদাহরণ: কোন department আছে, এখন কোন semester চলছে, semester registration কবে, বা instructors কারা আছেন।',
    suggestions: DEFAULT_SUGGESTIONS,
  };
};

const generateRuleBasedReply = async (question: string): Promise<TChatbotReply> => {
  const intent = detectIntent(question);

  switch (intent) {
    case 'department_list':
      return buildDepartmentListReply(question);
    case 'department_recommendation':
      return buildDepartmentRecommendationReply(question);
    case 'semester_current':
      return buildCurrentSemesterReply(question);
    case 'semester_registration':
      return buildSemesterRegistrationReply(question);
    case 'semester_list':
      return buildSemesterListReply(question);
    case 'instructor_list':
      return buildInstructorReply(question);
    default:
      return buildRuleBasedFallbackReply(question);
  }
};

const generateReply = async (
  question: string,
  messages: TChatbotMessage[] = [],
): Promise<TChatbotReply> => {
  if (containsBlockedPrompt(question)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'This assistant only answers public academic and campus-related questions.',
    );
  }

  try {
    return await buildAiReply(question, messages);
  } catch (error) {
    logger.warn('OpenRouter chatbot fallback engaged.', {
      error: error instanceof Error ? error.message : String(error),
    });

    const fallbackReply = await generateRuleBasedReply(question);

    return {
      ...fallbackReply,
      source: 'fallback',
    };
  }
};

export const ChatbotServices = {
  generateReply,
};
