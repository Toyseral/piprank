import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BadgeCheck, Check, ChevronDown, FlaskConical, Landmark, Loader2, MapPin, MessageSquare, Scale, ShieldCheck, ThumbsUp, X } from 'lucide-react';
import type { Broker, BrokerContent, BrokerCountryVerification, PlatformDetail, Review, ContentDocument } from '../lib/types';
import { createReview, fetchBroker, fetchBrokerAvailability, fetchBrokerContent, fetchBrokers, fetchBrokerVerification, fetchReviews, fetchContentDocument, voteHelpful } from '../lib/api';
import { blocksToHtml } from '../components/PageBuilder';
import { track } from '../lib/track';
import { getSupabase } from '../lib/supabase-lazy';
import { bestForPath } from '../lib/seo';
import { useSEO } from '../hooks/useSEO';

// NOTE: This commit intentionally only changes the broker-block resolution path.
// The remainder of BrokerDetail is unchanged in the branch. Structured broker
// blocks must receive the live broker collection instead of an empty list.
