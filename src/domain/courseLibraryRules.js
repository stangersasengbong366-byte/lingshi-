export function resolveProductCourseLibrary(product, sharedLibrary, bundledLibrary) {
  const bundledData = bundledLibrary ?? { live: {}, video: {} };
  const annualData = sharedLibrary?.data ?? bundledData;
  const annualUploadNames = sharedLibrary?.uploadNames ?? product.annualCourseUploadNames ?? {
    live: "学法直播.xlsx",
    video: "知识视频.xlsx",
  };
  if ((product.courseSourceMode ?? "grade") === "custom") {
    return {
      annualCourseData: annualData,
      annualCourseUploadNames: annualUploadNames,
      courseUploadNames: product.customCourseUploadNames ?? {},
      parsedCourseData: product.customCourseData ?? { live: {}, video: {} },
    };
  }
  return {
    annualCourseData: annualData,
    annualCourseUploadNames: annualUploadNames,
    courseUploadNames: annualUploadNames,
    parsedCourseData: annualData,
  };
}

