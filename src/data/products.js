import { g1AutumnCourseData } from "./g1AutumnCourseData";

export const moduleLibrary = [];

export const initialProducts = [
  {
    id: "g1-autumn-card",
    name: "高一秋实卡",
    grade: "高一",
    stage: "秋实卡",
    courseKey: "秋实卡",
    term: "26H2 秋季",
    status: "在售",
    coveragePhases: ["秋季"],
    videoPhases: ["秋季"],
    videoSubjects: ["语文", "数学", "英语", "物理", "化学"],
    subtitle: "高一秋季正课权益，学法直播搭配知识视频补基础。",
    core: {
      liveLessons: 16,
      liveDuration: "2h",
      knowledgeVideos: 40,
      videoDuration: "30min",
      servicePeriod: "4个月",
    },
    priceNote: "",
    videoReleasePlan: "",
    subjectProfiles: {
      default: {
        liveLessons: 16,
        knowledgeVideos: 40,
        summary: ["学法直播16节", "知识视频按所购科目开通"],
      },
    },
    humanitiesSubjects: [],
    salesNote: "学法直播负责大招教学和提分方法，知识视频用于补充直播中不熟的基础点，形成直播提分+视频补基的组合学习。",
    giftModuleIds: [],
    lessons: [],
    customGiftItems: [],
    giftSelections: null,
    courseUploadNames: {
      live: "高一年-秋实-学法直播.xlsx",
      video: "高一-秋实-知识视频_去数字小标题.xlsx",
    },
    parsedCourseData: g1AutumnCourseData,
    disableDefaultCourseCatalog: true,
  },
];
