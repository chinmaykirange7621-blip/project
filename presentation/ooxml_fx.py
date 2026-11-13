"""OOXML helpers for native glassmorphism, gradients, transitions, and animations."""

from __future__ import annotations

from lxml import etree
from pptx.oxml.ns import qn

A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
MC_NS = "http://schemas.openxmlformats.org/markup-compatibility/2006"
P159_NS = "http://schemas.microsoft.com/office/powerpoint/2015/09/main"


def _sub(parent, ns: str, tag: str, **attrib):
    el = etree.SubElement(parent, f"{{{ns}}}{tag}")
    for k, v in attrib.items():
        el.set(k, str(v))
    return el


def set_shape_glass(
    shape,
    fill_hex: str = "161F42",
    fill_alpha_pct: int = 80,
    border_hex: str = "FFFFFF",
    border_alpha_pct: int = 18,
    border_pt: float = 1.0,
    shadow: bool = True,
) -> None:
    """Apply native translucent glass fill, thin translucent border, and soft shadow."""
    spPr = shape._element.spPr

    # Clear existing fill & line children cleanly
    for tag in ("noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill", "ln", "effectLst"):
        old = spPr.find(qn(f"a:{tag}"))
        if old is not None:
            spPr.remove(old)

    solid = _sub(spPr, A_NS, "solidFill")
    clr = _sub(solid, A_NS, "srgbClr", val=fill_hex.upper())
    _sub(clr, A_NS, "alpha", val=str(int(fill_alpha_pct * 1000)))

    ln = _sub(spPr, A_NS, "ln", w=str(int(border_pt * 12700)))
    if border_pt > 0:
        ln_solid = _sub(ln, A_NS, "solidFill")
        ln_clr = _sub(ln_solid, A_NS, "srgbClr", val=border_hex.upper())
        _sub(ln_clr, A_NS, "alpha", val=str(int(border_alpha_pct * 1000)))
    else:
        _sub(ln, A_NS, "noFill")

    if shadow:
        eff = _sub(spPr, A_NS, "effectLst")
        sh = _sub(
            eff,
            A_NS,
            "outerShdw",
            blurRad="127000",
            dist="38100",
            dir="5400000",
            algn="tl",
            rotWithShape="0",
        )
        sclr = _sub(sh, A_NS, "srgbClr", val="000000")
        _sub(sclr, A_NS, "alpha", val="35000")


def set_shape_gradient(
    shape,
    start_hex: str = "2F6BFF",
    end_hex: str = "7B3FF2",
    angle_deg: float = 135.0,
    start_alpha_pct: int = 100,
    end_alpha_pct: int = 100,
    border_hex: str | None = None,
    border_alpha_pct: int = 25,
    border_pt: float = 0.0,
) -> None:
    """Apply native linear gradient fill and optional border to a shape."""
    spPr = shape._element.spPr
    for tag in ("noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill", "ln"):
        old = spPr.find(qn(f"a:{tag}"))
        if old is not None:
            spPr.remove(old)

    grad = _sub(spPr, A_NS, "gradFill", rotWithShape="1")
    gsLst = _sub(grad, A_NS, "gsLst")

    gs1 = _sub(gsLst, A_NS, "gs", pos="0")
    c1 = _sub(gs1, A_NS, "srgbClr", val=start_hex.upper())
    if start_alpha_pct < 100:
        _sub(c1, A_NS, "alpha", val=str(int(start_alpha_pct * 1000)))

    gs2 = _sub(gsLst, A_NS, "gs", pos="100000")
    c2 = _sub(gs2, A_NS, "srgbClr", val=end_hex.upper())
    if end_alpha_pct < 100:
        _sub(c2, A_NS, "alpha", val=str(int(end_alpha_pct * 1000)))

    _sub(grad, A_NS, "lin", ang=str(int(angle_deg * 60000)), scaled="1")

    ln = _sub(spPr, A_NS, "ln", w=str(int(max(border_pt, 0) * 12700)))
    if border_hex and border_pt > 0:
        ln_solid = _sub(ln, A_NS, "solidFill")
        ln_clr = _sub(ln_solid, A_NS, "srgbClr", val=border_hex.upper())
        _sub(ln_clr, A_NS, "alpha", val=str(int(border_alpha_pct * 1000)))
    else:
        _sub(ln, A_NS, "noFill")


def set_solid_alpha(shape, fill_hex: str, alpha_pct: int = 100, border_pt: float = 0.0, border_hex: str | None = None) -> None:
    """Apply solid color with optional alpha and optional border."""
    spPr = shape._element.spPr
    for tag in ("noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill", "ln"):
        old = spPr.find(qn(f"a:{tag}"))
        if old is not None:
            spPr.remove(old)

    solid = _sub(spPr, A_NS, "solidFill")
    c = _sub(solid, A_NS, "srgbClr", val=fill_hex.upper())
    if alpha_pct < 100:
        _sub(c, A_NS, "alpha", val=str(int(alpha_pct * 1000)))

    ln = _sub(spPr, A_NS, "ln", w=str(int(max(border_pt, 0) * 12700)))
    if border_hex and border_pt > 0:
        ls = _sub(ln, A_NS, "solidFill")
        _sub(ls, A_NS, "srgbClr", val=border_hex.upper())
    else:
        _sub(ln, A_NS, "noFill")


def set_alt_text(shape, alt_text: str, name: str | None = None) -> None:
    """Set accessibility alt text and optional shape name (e.g., !!morph_id)."""
    el = shape._element
    cNvPr = None
    for parent_tag in ("p:nvSpPr", "p:nvPicPr", "p:nvCxnSpPr"):
        parent = el.find(qn(parent_tag))
        if parent is not None:
            cNvPr = parent.find(qn("p:cNvPr"))
            if cNvPr is not None:
                break
    if cNvPr is not None:
        cNvPr.set("descr", alt_text)
        if name:
            cNvPr.set("name", name)


def _insert_slide_child_in_order(sld, new_el) -> None:
    """Insert <p:transition>/<mc:AlternateContent>/<p:timing> in ECMA-376 child order."""
    tag = etree.QName(new_el).localname
    # Order in <p:sld>: cSld, clrMapOvr, transition/AlternateContent, timing, extLst
    if tag in ("transition", "AlternateContent"):
        for existing in list(sld):
            if etree.QName(existing).localname in ("transition", "AlternateContent"):
                sld.remove(existing)
        anchor = sld.find(qn("p:timing"))
        if anchor is None:
            anchor = sld.find(qn("p:extLst"))
        if anchor is not None:
            sld.insert(list(sld).index(anchor), new_el)
        else:
            sld.append(new_el)
    elif tag == "timing":
        old = sld.find(qn("p:timing"))
        if old is not None:
            sld.remove(old)
        anchor = sld.find(qn("p:extLst"))
        if anchor is not None:
            sld.insert(list(sld).index(anchor), new_el)
        else:
            sld.append(new_el)


def set_slide_transition(slide, kind: str = "fade", speed: str = "med") -> None:
    """Apply Fade or Morph transition (with mc:AlternateContent Fade fallback)."""
    sld = slide._element
    if kind == "morph":
        alt = etree.Element(f"{{{MC_NS}}}AlternateContent", nsmap={"mc": MC_NS})
        choice = etree.SubElement(alt, f"{{{MC_NS}}}Choice", nsmap={"p159": P159_NS})
        choice.set("Requires", "p159")
        tr_m = etree.SubElement(choice, f"{{{P_NS}}}transition", spd=speed)
        m_el = etree.SubElement(tr_m, f"{{{P159_NS}}}morph")
        m_el.set("option", "byObject")

        fb = etree.SubElement(alt, f"{{{MC_NS}}}Fallback")
        tr_f = etree.SubElement(fb, f"{{{P_NS}}}transition", spd=speed)
        etree.SubElement(tr_f, f"{{{P_NS}}}fade")
        _insert_slide_child_in_order(sld, alt)
    else:
        tr = etree.Element(f"{{{P_NS}}}transition", spd=speed)
        etree.SubElement(tr, f"{{{P_NS}}}fade")
        _insert_slide_child_in_order(sld, tr)


class SlideAnimator:
    """Builds valid PowerPoint OOXML <p:timing> sequences (<0.8s, zero bounce/spin/sound)."""

    def __init__(self, slide) -> None:
        self.slide = slide
        self._id = 1
        self._steps: list[dict] = []

    def _next_id(self) -> str:
        self._id += 1
        return str(self._id)

    def add_fade(self, shape, dur: int = 450, delay: int = 0, node_type: str = "afterEffect") -> None:
        self._steps.append(
            {"kind": "fade", "spid": shape.shape_id, "dur": min(dur, 750), "delay": delay, "node_type": node_type}
        )

    def add_fade_rise(self, shape, dur: int = 500, delay: int = 0, dy: str = "1500", node_type: str = "afterEffect") -> None:
        self._steps.append(
            {"kind": "fade_rise", "spid": shape.shape_id, "dur": min(dur, 750), "delay": delay, "dy": dy, "node_type": node_type}
        )

    def add_slide_in(self, shape, direction: str = "left", dur: int = 500, delay: int = 0, node_type: str = "afterEffect") -> None:
        self._steps.append(
            {"kind": "slide_in", "spid": shape.shape_id, "dir": direction, "dur": min(dur, 750), "delay": delay, "node_type": node_type}
        )

    def add_zoom_in(self, shape, dur: int = 500, delay: int = 0, node_type: str = "afterEffect") -> None:
        self._steps.append(
            {"kind": "zoom", "spid": shape.shape_id, "dur": min(dur, 750), "delay": delay, "node_type": node_type}
        )

    def add_wipe(self, shape, direction: str = "right", dur: int = 320, delay: int = 0, node_type: str = "afterEffect") -> None:
        self._steps.append(
            {"kind": "wipe", "spid": shape.shape_id, "dir": direction, "dur": min(dur, 750), "delay": delay, "node_type": node_type}
        )

    def add_drift(self, shape, path: str = "M 0 0 L 0.012 -0.010 E", dur: int = 750, delay: int = 0) -> None:
        self._steps.append(
            {"kind": "drift", "spid": shape.shape_id, "path": path, "dur": min(dur, 750), "delay": delay, "node_type": "withEffect"}
        )

    def apply(self) -> None:
        if not self._steps:
            return

        timing = etree.Element(f"{{{P_NS}}}timing")
        tnLst = _sub(timing, P_NS, "tnLst")

        root_par = _sub(tnLst, P_NS, "par")
        root_ctn = _sub(root_par, P_NS, "cTn", id="1", dur="indefinite", restart="never", nodeType="tmRoot")
        root_children = _sub(root_ctn, P_NS, "childTnLst")

        seq = _sub(root_children, P_NS, "seq", concurrent="1", nextAc="seek")
        seq_ctn = _sub(seq, P_NS, "cTn", id=self._next_id(), dur="indefinite", nodeType="mainSeq")
        seq_children = _sub(seq_ctn, P_NS, "childTnLst")

        prev_conds = _sub(seq, P_NS, "prevCondLst")
        pc = _sub(prev_conds, P_NS, "cond", evt="onPrev", delay="0")
        _sub(_sub(pc, P_NS, "tgtEl"), P_NS, "sldTgt")

        next_conds = _sub(seq, P_NS, "nextCondLst")
        nc = _sub(next_conds, P_NS, "cond", evt="onNext", delay="0")
        _sub(_sub(nc, P_NS, "tgtEl"), P_NS, "sldTgt")

        # Put all slide entry steps under one auto-starting sequence group so flow runs smoothly
        outer_par = _sub(seq_children, P_NS, "par")
        outer_ctn = _sub(outer_par, P_NS, "cTn", id=self._next_id(), fill="hold")
        _sub(_sub(outer_ctn, P_NS, "stCondLst"), P_NS, "cond", delay="0")
        outer_children = _sub(outer_ctn, P_NS, "childTnLst")

        grp_par = _sub(outer_children, P_NS, "par")
        grp_ctn = _sub(grp_par, P_NS, "cTn", id=self._next_id(), fill="hold")
        _sub(_sub(grp_ctn, P_NS, "stCondLst"), P_NS, "cond", delay="0")
        grp_children = _sub(grp_ctn, P_NS, "childTnLst")

        for idx, step in enumerate(self._steps):
            spid = str(step["spid"])
            dur = str(step["dur"])
            delay = str(step["delay"])
            kind = step["kind"]
            ntype = step["node_type"] if idx > 0 else "afterEffect"

            preset_id = "10"
            preset_class = "entr"
            subtype = "0"
            if kind == "wipe":
                preset_id = "22"
                subtype_map = {"up": "4", "right": "8", "down": "1", "left": "2"}
                subtype = subtype_map.get(step.get("dir", "right"), "8")
            elif kind == "zoom":
                preset_id = "53"
            elif kind == "slide_in":
                preset_id = "2"
                subtype = "8" if step.get("dir") == "left" else "2"
            elif kind == "drift":
                preset_id = "0"
                preset_class = "path"

            eff_par = _sub(grp_children, P_NS, "par")
            eff_ctn = _sub(
                eff_par,
                P_NS,
                "cTn",
                id=self._next_id(),
                presetID=preset_id,
                presetClass=preset_class,
                presetSubtype=subtype,
                fill="hold",
                nodeType=ntype,
            )
            _sub(_sub(eff_ctn, P_NS, "stCondLst"), P_NS, "cond", delay=delay)
            eff_children = _sub(eff_ctn, P_NS, "childTnLst")

            if kind != "drift":
                # Visibility on
                set_el = _sub(eff_children, P_NS, "set")
                cBhvr = _sub(set_el, P_NS, "cBhvr")
                set_ctn = _sub(cBhvr, P_NS, "cTn", id=self._next_id(), dur="1", fill="hold")
                set_st = _sub(set_ctn, P_NS, "stCondLst")
                _sub(set_st, P_NS, "cond", delay="0")
                _sub(_sub(cBhvr, P_NS, "tgtEl"), P_NS, "spTgt", spid=spid)
                _sub(_sub(cBhvr, P_NS, "attrNameLst"), P_NS, "attrName").text = "style.visibility"
                _sub(_sub(set_el, P_NS, "to"), P_NS, "strVal", val="visible")

            if kind == "fade":
                ae = _sub(eff_children, P_NS, "animEffect", transition="in", filter="fade")
                cb = _sub(ae, P_NS, "cBhvr")
                _sub(cb, P_NS, "cTn", id=self._next_id(), dur=dur, fill="hold")
                _sub(_sub(cb, P_NS, "tgtEl"), P_NS, "spTgt", spid=spid)

            elif kind == "fade_rise":
                ae = _sub(eff_children, P_NS, "animEffect", transition="in", filter="fade")
                cb = _sub(ae, P_NS, "cBhvr")
                _sub(cb, P_NS, "cTn", id=self._next_id(), dur=dur, fill="hold")
                _sub(_sub(cb, P_NS, "tgtEl"), P_NS, "spTgt", spid=spid)

                anim_y = _sub(eff_children, P_NS, "anim", calcmode="lin", valueType="num")
                cb_y = _sub(anim_y, P_NS, "cBhvr", additive="base")
                _sub(cb_y, P_NS, "cTn", id=self._next_id(), dur=dur, fill="hold")
                _sub(_sub(cb_y, P_NS, "tgtEl"), P_NS, "spTgt", spid=spid)
                _sub(_sub(cb_y, P_NS, "attrNameLst"), P_NS, "attrName").text = "ppt_y"
                tav = _sub(anim_y, P_NS, "tavLst")
                t0 = _sub(tav, P_NS, "tav", tm="0")
                _sub(_sub(t0, P_NS, "val"), P_NS, "strVal", val="#ppt_y+0.025")
                t1 = _sub(tav, P_NS, "tav", tm="100000")
                _sub(_sub(t1, P_NS, "val"), P_NS, "strVal", val="#ppt_y")

            elif kind == "slide_in":
                offset = "-0.05" if step.get("dir") == "left" else "+0.05"
                ae = _sub(eff_children, P_NS, "animEffect", transition="in", filter="fade")
                cb = _sub(ae, P_NS, "cBhvr")
                _sub(cb, P_NS, "cTn", id=self._next_id(), dur=dur, fill="hold")
                _sub(_sub(cb, P_NS, "tgtEl"), P_NS, "spTgt", spid=spid)

                anim_x = _sub(eff_children, P_NS, "anim", calcmode="lin", valueType="num")
                cb_x = _sub(anim_x, P_NS, "cBhvr", additive="base")
                _sub(cb_x, P_NS, "cTn", id=self._next_id(), dur=dur, fill="hold")
                _sub(_sub(cb_x, P_NS, "tgtEl"), P_NS, "spTgt", spid=spid)
                _sub(_sub(cb_x, P_NS, "attrNameLst"), P_NS, "attrName").text = "ppt_x"
                tav = _sub(anim_x, P_NS, "tavLst")
                t0 = _sub(tav, P_NS, "tav", tm="0")
                _sub(_sub(t0, P_NS, "val"), P_NS, "strVal", val=f"#ppt_x{offset}")
                t1 = _sub(tav, P_NS, "tav", tm="100000")
                _sub(_sub(t1, P_NS, "val"), P_NS, "strVal", val="#ppt_x")

            elif kind == "zoom":
                ae = _sub(eff_children, P_NS, "animEffect", transition="in", filter="fade")
                cb = _sub(ae, P_NS, "cBhvr")
                _sub(cb, P_NS, "cTn", id=self._next_id(), dur=dur, fill="hold")
                _sub(_sub(cb, P_NS, "tgtEl"), P_NS, "spTgt", spid=spid)

                sc = _sub(eff_children, P_NS, "animScale")
                cb_s = _sub(sc, P_NS, "cBhvr")
                _sub(cb_s, P_NS, "cTn", id=self._next_id(), dur=dur, fill="hold")
                _sub(_sub(cb_s, P_NS, "tgtEl"), P_NS, "spTgt", spid=spid)
                _sub(sc, P_NS, "from", x="88000", y="88000")
                _sub(sc, P_NS, "to", x="100000", y="100000")

            elif kind == "wipe":
                d = step.get("dir", "right")
                ae = _sub(eff_children, P_NS, "animEffect", transition="in", filter=f"wipe({d})")
                cb = _sub(ae, P_NS, "cBhvr")
                _sub(cb, P_NS, "cTn", id=self._next_id(), dur=dur, fill="hold")
                _sub(_sub(cb, P_NS, "tgtEl"), P_NS, "spTgt", spid=spid)

            elif kind == "drift":
                mot = _sub(eff_children, P_NS, "animMotion", origin="layout", path=step["path"], pathEditMode="relative")
                cb_m = _sub(mot, P_NS, "cBhvr")
                _sub(cb_m, P_NS, "cTn", id=self._next_id(), dur=dur, fill="hold", autoRev="1")
                _sub(_sub(cb_m, P_NS, "tgtEl"), P_NS, "spTgt", spid=spid)

        _insert_slide_child_in_order(self.slide._element, timing)
