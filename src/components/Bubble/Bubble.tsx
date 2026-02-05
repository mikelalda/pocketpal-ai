import type {ReactNode} from 'react';
import React, {useContext, useState} from 'react';
import {View, TouchableOpacity, Animated} from 'react-native';

import {Text} from 'react-native-paper';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import {useTheme} from '../../hooks';

import {styles} from './styles';

import {UserContext, L10nContext} from '../../utils';
import {MessageType} from '../../utils/types';
import {chatSessionStore} from '../../store';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export type RlhfRating = 'positive' | 'negative' | null;

export const Bubble = ({
  child,
  message,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nextMessageInGroup,
  scale = new Animated.Value(1),
}: {
  child: ReactNode;
  message: MessageType.Any;
  nextMessageInGroup: boolean;
  scale?: Animated.Value;
}) => {
  const theme = useTheme();
  const user = useContext(UserContext);
  const l10n = useContext(L10nContext);
  const currentUserIsAuthor = user?.id === message.author.id;
  const {copyable, timings, rlhfRating} = message.metadata || {};

  // Local state for optimistic UI updates
  const [localRating, setLocalRating] = useState<RlhfRating>(
    rlhfRating as RlhfRating,
  );

  const timingsString = l10n.components.bubble.timingsString
    .replace('{{predictedMs}}', timings?.predicted_per_token_ms?.toFixed())
    .replace(
      '{{predictedPerSecond}}',
      timings?.predicted_per_second?.toFixed(2),
    );

  // Add time to first token if available
  const timeToFirstTokenString =
    timings?.time_to_first_token_ms !== undefined &&
    timings?.time_to_first_token_ms !== null
      ? `, ${timings.time_to_first_token_ms}ms TTFT`
      : '';

  const fullTimingsString = timingsString + timeToFirstTokenString;

  const {
    contentContainer,
    dateHeaderContainer,
    dateHeader,
    iconContainer,
    ratingContainer,
    ratingIcon,
    ratingIconActive,
  } = styles({
    currentUserIsAuthor,
    message,
    roundBorder: true,
    theme,
  });

  const copyToClipboard = () => {
    if (message.type === 'text') {
      ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
      Clipboard.setString(message.text.trim());
    }
  };

  const handleRating = async (rating: RlhfRating) => {
    // Toggle rating: if same rating is clicked again, remove it
    const newRating = localRating === rating ? null : rating;
    setLocalRating(newRating);
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);

    // Get current session ID
    const sessionId = chatSessionStore.activeSessionId;
    if (sessionId && message.type === 'text') {
      // Update message metadata with the rating
      await chatSessionStore.updateMessage(message.id, sessionId, {
        metadata: {
          ...message.metadata,
          rlhfRating: newRating,
          rlhfRatedAt: newRating ? new Date().toISOString() : undefined,
        },
      });
    }
  };

  // Show rating buttons only for AI messages (not user messages)
  const showRatingButtons = !currentUserIsAuthor && timings;

  return (
    <Animated.View
      testID={currentUserIsAuthor ? 'user-message' : 'ai-message'}
      style={[
        contentContainer,
        {
          transform: [{scale}],
        },
      ]}>
      {child}
      {timings && (
        <View style={dateHeaderContainer} testID="message-timing">
          {copyable && (
            <TouchableOpacity onPress={copyToClipboard}>
              <Icon name="content-copy" style={iconContainer} />
            </TouchableOpacity>
          )}
          {showRatingButtons && (
            <View style={ratingContainer}>
              <TouchableOpacity
                onPress={() => handleRating('positive')}
                testID="rating-positive"
                accessibilityLabel={l10n.components.bubble.ratePositive}>
                <Icon
                  name={
                    localRating === 'positive' ? 'thumb-up' : 'thumb-up-outline'
                  }
                  style={[
                    ratingIcon,
                    localRating === 'positive' && ratingIconActive,
                  ]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRating('negative')}
                testID="rating-negative"
                accessibilityLabel={l10n.components.bubble.rateNegative}>
                <Icon
                  name={
                    localRating === 'negative'
                      ? 'thumb-down'
                      : 'thumb-down-outline'
                  }
                  style={[
                    ratingIcon,
                    localRating === 'negative' && ratingIconActive,
                  ]}
                />
              </TouchableOpacity>
            </View>
          )}
          {timings && <Text style={dateHeader}>{fullTimingsString}</Text>}
        </View>
      )}
    </Animated.View>
  );
};
