import React, { useEffect, useState } from 'react';
import Tooltip from './Tooltip';
import TutorialModal from './TutorialModal';
import * as hrService from '../services/hrService';
import useAsync from '../hooks/useAsync';
import StaffAppraisal from './StaffAppraisal';
import { HR_CSS } from './HumanResource.jsx';

/* ═══════════════════════════════════════════════════════════════════
   STAFF APPRAISALS — top-level module page.

   Mirrors the page-header chrome used by every other ERP module
   (gradient title icon + tutorial button) and then mounts the
   StaffAppraisal body. The HR mock data (depts / desigs / employees)
   is fetched here so this page is self-contained even though the
   actual reads happen against the shared HR service.
   ═══════════════════════════════════════════════════════════════════ */
export default function StaffAppraisalPage({ toast = () => {} }) {
  /* Fetch + mirror the same way HumanResource does, so cross-module
     consistency is preserved. */
  const { data: serverDepts  = [] } = useAsync(hrService.getHrDepts, []);
  const { data: serverDesigs = [] } = useAsync(hrService.getHrDesigs, []);
  const { data: serverEmps   = [] } = useAsync(hrService.getHrEmployees, []);

  const [depts,  setDepts]  = useState(null);
  const [desigs, setDesigs] = useState(null);
  const [emps,   setEmps]   = useState(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  useEffect(() => { if (serverDepts.length  && depts  == null) setDepts(serverDepts);   }, [serverDepts,  depts]);
  useEffect(() => { if (serverDesigs.length && desigs == null) setDesigs(serverDesigs); }, [serverDesigs, desigs]);
  useEffect(() => { if (serverEmps.length   && emps   == null) setEmps(serverEmps);     }, [serverEmps,   emps]);

  return (
    <>
      {/* Inject the shared HR chrome (buttons, modal shell, form inputs,
          pills, info banners, etc.) so this page renders correctly even
          when the user lands here without having visited HR first. */}
      <style>{HR_CSS}</style>

      {/* Page header — same shape system as the rest of the ERP shell. */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className="fa-solid fa-star"></i>
          </div>
          <div>
            <div className="page-title">Staff Appraisals</div>
            <div className="page-sub">Evaluate staff fairly, recognise the best, and grow the rest</div>
          </div>
        </div>
        <Tooltip text="Play a short tutorial for the Staff Appraisals module">
          <button
            className="tutorial-btn page-tutorial-btn"
            onClick={() => setTutorialOpen(true)}
            aria-label="Open Staff Appraisals tutorials"
          >
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
      </div>

      <StaffAppraisal
        emps={emps || []}
        depts={depts || []}
        desigs={desigs || []}
        toast={toast}
      />

      <TutorialModal
        open={tutorialOpen}
        moduleKey="staffAppraisal"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}
