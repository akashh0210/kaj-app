// Technician screen strings in English and Bengali.
// Bengali was written for this prototype: have a native speaker check it before real use.
export const STRINGS = {
  en: {
    switchTo: 'বাংলা',
    switchLabel: 'Switch language to Bengali',
    todaysVisits: "Today's visits",
    noVisits: 'No visits today.',
    open: 'Open',
    openVisit: name => `Open visit for ${name}`,
    back: 'Back',
    tapToRecord: 'Tap the mic button to record your update',
    tapToStop: 'Recording… tap again to stop',
    recording: 'Recording…',
    startRecording: 'Start recording',
    stopRecording: 'Stop recording',
    addPhoto: 'Add photo',
    photoAttached: name => `${name || 'Photo'} attached`,
    remove: 'Remove',
    removePhoto: 'Remove photo',
    processing: 'Processing voice note with AI…',
    failedSaved: 'The voice note could not be processed. Your recording is saved.',
    tryAgain: 'Try again',
    reRecord: 'Re-record',
    needsReview: 'Needs review',
    jobSummary: 'Job summary',
    jobSlip: 'Job slip',
    confirmedStamp: 'Confirmed',
    summaryEnglishNote: 'Summary is in English for the owner.',
    noSummary: '(No summary extracted)',
    unitsServiced: 'Units serviced',
    unitsPending: 'Units pending',
    extraWork: 'Extra work (draft bill)',
    confirm: 'Confirm',
    confirming: 'Confirming…',
    submitted: 'Update sent to the owner for review',
    processingFailed: 'Processing failed: ',
    noRecorder: 'This browser cannot record audio. Please open KAJ in Chrome or Safari.',
    micDenied: 'Microphone permission denied. Allow the microphone in your browser settings.',
    micError: 'Could not start the microphone: ',
    recorderError: 'Recording failed to start: ',
    nothingRecorded: 'Nothing was recorded. Please try again.',
    choosePhoto: 'Please choose a photo.',
    photoAdded: 'Photo attached',
    error: 'Error: ',
    status: { done: 'Done', scheduled: 'Scheduled', pending_confirmation: 'Pending review', missed: 'Missed' },
    dateLocale: 'en-IN',
  },
  bn: {
    switchTo: 'English',
    switchLabel: 'ভাষা ইংরেজিতে বদলান',
    todaysVisits: 'আজকের ভিজিট',
    noVisits: 'আজ কোনো ভিজিট নেই।',
    open: 'খুলুন',
    openVisit: name => `${name}-এর ভিজিট খুলুন`,
    back: 'ফিরে যান',
    tapToRecord: 'আপডেট রেকর্ড করতে মাইক বোতামে ট্যাপ করুন',
    tapToStop: 'রেকর্ড হচ্ছে… থামাতে আবার ট্যাপ করুন',
    recording: 'রেকর্ড হচ্ছে…',
    startRecording: 'রেকর্ডিং শুরু করুন',
    stopRecording: 'রেকর্ডিং থামান',
    addPhoto: 'ছবি যোগ করুন',
    photoAttached: name => `${name || 'ছবি'} যুক্ত হয়েছে`,
    remove: 'সরান',
    removePhoto: 'ছবি সরান',
    processing: 'AI দিয়ে ভয়েস নোট দেখা হচ্ছে…',
    failedSaved: 'ভয়েস নোটটি প্রসেস করা যায়নি। আপনার রেকর্ডিং সংরক্ষিত আছে।',
    tryAgain: 'আবার চেষ্টা করুন',
    reRecord: 'আবার রেকর্ড করুন',
    needsReview: 'যাচাই দরকার',
    jobSummary: 'কাজের সারাংশ',
    jobSlip: 'কাজের স্লিপ',
    confirmedStamp: 'নিশ্চিত',
    summaryEnglishNote: 'মালিকের জন্য সারাংশ ইংরেজিতে দেওয়া হয়েছে।',
    noSummary: '(কোনো সারাংশ পাওয়া যায়নি)',
    unitsServiced: 'সার্ভিস করা ইউনিট',
    unitsPending: 'বাকি ইউনিট',
    extraWork: 'অতিরিক্ত কাজ (খসড়া বিল)',
    confirm: 'নিশ্চিত করুন',
    confirming: 'নিশ্চিত করা হচ্ছে…',
    submitted: 'আপডেট মালিকের যাচাইয়ের জন্য পাঠানো হয়েছে',
    processingFailed: 'প্রসেস করা যায়নি: ',
    noRecorder: 'এই ব্রাউজারে অডিও রেকর্ড করা যায় না। Chrome বা Safari-তে KAJ খুলুন।',
    micDenied: 'মাইক্রোফোনের অনুমতি নেই। ব্রাউজার সেটিংসে মাইক্রোফোন চালু করুন।',
    micError: 'মাইক্রোফোন চালু করা যায়নি: ',
    recorderError: 'রেকর্ডিং শুরু করা যায়নি: ',
    nothingRecorded: 'কিছু রেকর্ড হয়নি। আবার চেষ্টা করুন।',
    choosePhoto: 'একটি ছবি বেছে নিন।',
    photoAdded: 'ছবি যুক্ত হয়েছে',
    error: 'সমস্যা: ',
    status: { done: 'সম্পন্ন', scheduled: 'নির্ধারিত', pending_confirmation: 'যাচাই বাকি', missed: 'বাদ পড়েছে' },
    dateLocale: 'bn-IN',
  },
}

const STORAGE_KEY = 'kaj.techLang'

// Remembered per device; storage can be blocked, so never rely on it.
export function loadLang() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'bn') return v
  } catch { /* storage unavailable */ }
  return 'en'
}

export function saveLang(lang) {
  try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* storage unavailable */ }
}
