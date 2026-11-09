import React from 'react';
import { Sparkles } from 'lucide-react';
import { TopicId } from '../types';
import { TOPIC_CHANNELS } from '../utils/validation';

interface StoryRingProps {
  selectedTopic: TopicId | 'all';
  onSelectTopic: (topic: TopicId | 'all') => void;
  topicCounts: Record<string, number>;
}

export const StoryRing: React.FC<StoryRingProps> = ({
  selectedTopic,
  onSelectTopic,
  topicCounts,
}) => {
  return (
    <section
      aria-label="Topic Channels"
      className="w-full rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] px-3 sm:px-4 py-3.5 mb-5"
    >
      <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4 overflow-x-auto pb-0.5">
        {/* All Topics button */}
        <button
          type="button"
          onClick={() => onSelectTopic('all')}
          aria-pressed={selectedTopic === 'all'}
          className="group flex flex-col items-center gap-1.5 shrink-0 min-w-[54px] sm:min-w-[68px] min-h-[44px] focus:outline-none"
        >
          <div
            className={`p-[2.5px] rounded-full transition-transform duration-150 group-hover:scale-105 group-active:scale-95 ${
              selectedTopic === 'all'
                ? 'bg-cohert-gradient shadow-sm'
                : 'bg-[#DBDBDB] dark:bg-[#262626]'
            }`}
          >
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-[#FFFFFF] dark:bg-[#121212] p-[2px] flex items-center justify-center">
              <div
                className={`w-full h-full rounded-full flex items-center justify-center transition-colors ${
                  selectedTopic === 'all'
                    ? 'bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#833AB4] dark:text-[#FCB045]'
                    : 'bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#737373] dark:text-[#A8A8A8]'
                }`}
              >
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          </div>
          <span
            className={`text-[11px] sm:text-xs whitespace-nowrap transition-colors ${
              selectedTopic === 'all'
                ? 'font-semibold text-[#262626] dark:text-[#F5F5F5]'
                : 'font-normal text-[#737373] dark:text-[#A8A8A8]'
            }`}
          >
            All Posts
          </span>
        </button>

        {/* 5 Topic Channels */}
        {TOPIC_CHANNELS.map((channel) => {
          const isActive = selectedTopic === channel.id;
          const count = topicCounts[channel.id] || 0;
          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onSelectTopic(isActive ? 'all' : channel.id)}
              aria-pressed={isActive}
              title={channel.description}
              className="group flex flex-col items-center gap-1.5 shrink-0 min-w-[54px] sm:min-w-[68px] min-h-[44px] focus:outline-none"
            >
              <div
                className={`p-[2.5px] rounded-full transition-transform duration-150 group-hover:scale-105 group-active:scale-95 ${
                  isActive
                    ? 'bg-cohert-gradient shadow-md'
                    : 'bg-cohert-gradient opacity-80 group-hover:opacity-100'
                }`}
              >
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-[#FFFFFF] dark:bg-[#121212] p-[2px] flex items-center justify-center relative">
                  <div
                    className={`w-full h-full rounded-full flex items-center justify-center text-lg sm:text-xl transition-colors ${
                      isActive
                        ? 'bg-[#833AB4]/10 dark:bg-[#FCB045]/15'
                        : 'bg-[#FAFAFA] dark:bg-[#1A1A1A]'
                    }`}
                  >
                    <span aria-hidden="true">
                      {channel.emoji}
                    </span>
                  </div>
                  {count > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-0.5 right-0 text-[10px] font-semibold tabular-nums px-1.5 py-0.2 rounded-full bg-[#262626] dark:bg-[#F5F5F5] text-[#FFFFFF] dark:text-[#000000]"
                    >
                      {count}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`text-[11px] sm:text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? 'font-semibold text-[#262626] dark:text-[#F5F5F5]'
                    : 'font-normal text-[#737373] dark:text-[#A8A8A8]'
                }`}
              >
                {channel.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
