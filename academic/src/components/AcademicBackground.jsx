import { education, awards, isSectionVisible } from "../siteConfig";
import { Landmark, Trophy } from "lucide-react";
import "../css/AcademicBackground.css";

export default function AcademicBackground() {
  return <>
    {isSectionVisible(education) && <section className="academic-section" id="education" aria-labelledby="education-heading">
      <h2 className="card-title" id="education-heading">Education</h2>
      <ul className="academic-list education-path">
        {education.items.map((item, index) => <li className="academic-item" key={`${item.institution}-${index}`}>
          <span className="school-emblem" aria-hidden="true"><Landmark /></span>
          <div className="academic-details">
            <div className="academic-item-heading"><h3>{item.institution}</h3></div>
            <div className="education-meta">{item.degree && <span className="education-degree">{item.degree}</span>}{item.period && <span className="education-period">{item.period}</span>}</div>
            {item.field && <p className="academic-subtitle">{item.field}</p>}
            {item.description && <p className="academic-description">{item.description}</p>}
          </div>
          {item.location && <span className="academic-location">{item.location}</span>}
        </li>)}
      </ul>
    </section>}
    {isSectionVisible(awards) && <section className="academic-section" id="awards" aria-labelledby="awards-heading">
      <h2 className="card-title" id="awards-heading">Selected Awards</h2>
        <ul className="academic-list awards-list">
        {awards.items.map((item, index) => <li className="academic-item" key={`${item.title}-${index}`}>
          <span className="honor-emblem" aria-hidden="true"><Trophy /></span>
          <div className="academic-details">
            <div className="academic-item-heading"><h3>{item.title}</h3></div>
            {item.organization && <p className="academic-subtitle">{item.organization}</p>}
            {item.description && <p className="academic-description">{item.description}</p>}
          </div>
          {item.year && <span className="award-year">{item.year}</span>}
        </li>)}
        </ul>
    </section>}
  </>;
}
