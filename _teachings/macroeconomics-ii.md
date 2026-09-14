---
layout: page
title: Macroeconomics II
description: Modern macroeconomics through microfounded general-equilibrium models, from one-period and two-period closed-economy models to open-economy models.
instructor: Arturo López
level: Undergraduate (Licenciatura en Economía)
year: 2026
term: Fall
location: Centro de Investigación y Docencia Económicas (CIDE)
time: Tuesdays and Thursdays, 8:00-9:30 am
course_id: macroeconomics-ii
schedule:
  - week: Lecture 1
    date: Aug 25
    topic: Welcome and introduction
    description: Course overview and some thoughts on macroeconomic theory and empirical macro.
    materials:
      - name: Lecture Slides
        url: /assets/teaching/macroeconomics-ii/Slides/Macro-II_01_Introducción.pdf

  - week: Lecture 2
    date: Aug 27
    topic: Consumer and Firm Behavior
    description: Optimal decision-making by representative households and firms in a one-period model.
    materials:
      - name: Lecture Slides
        url: /assets/teaching/macroeconomics-ii/Slides/Macro-II_02_Consumidor_Empresa.pdf

  - week: Lecture 3
    date: Sept 3
    topic: General Equilibrium in a One-Period Economy
    description: General equilibrium in a two-agents-one-period model.
    materials:
      - name: Lecture Slides
        url: /assets/teaching/macroeconomics-ii/Slides/Macro-II_03_Equilibrio_General_Economia_Cerrada.pdf

problem_sets:
  - week: Problem Set 1
    topic: Consumer and Firm Behavior
    description: Household labor supply and consumption demand, firm labor demand, and labor-market policies.
    materials:
      - name: Problem Set
        url: /assets/teaching/macroeconomics-ii/Problem%20Sets/Problem_Set_1_Macro_II.pdf

  - week: Problem Set 2
    topic: General Equilibrium in a One-Period Economy
    description: Fiscal and productivity shocks in a one-period general equilibrium model.
    materials:
      - name: Problem Set
        url: /assets/teaching/macroeconomics-ii/Problem%20Sets/Problem_Set_2_Macro_II.pdf
      - name: Solver
        url: /assets/teaching/macroeconomics-ii/Problem%20Sets/Problem_Set_2_Macro_II_solver.pdf
---

<div class="course">
  <div class="course-info">
    <p><strong>Instructor:</strong> {{ page.instructor }}</p>
    <p><strong>Term:</strong> {{ page.term }}</p>
    <p><strong>Location:</strong> {{ page.location }}</p>
    <p><strong>Time:</strong> {{ page.time }}</p>
  </div>
</div>

## Level
Undergraduate (Licenciatura en Economía)

## Course Overview

This course develops the conceptual and analytical tools needed to construct, solve, and interpret modern microfounded macroeconomic models. It begins with a one-period general equilibrium model of a closed economy, introduces intertemporal decision-making in a two-period setting, and then moves to business cycle and New Keynesian models to study fiscal and monetary policy. Finally, the course extends these tools to the analysis of small open-economy macroeconomic models.

The public materials are currently provided in Spanish, their original classroom language. Website navigation and descriptions are in English.

You can download the syllabus (temario) [here]({{ '/assets/teaching/macroeconomics-ii/Syllabus/Macro_II_Syllabus.pdf' | relative_url }}).

## Main References

- Stephen D. Williamson (2018). _Macroeconomics_. 6th edition. Pearson Education Limited.
- Pablo Kurlat (2020). _A Course in Modern Macroeconomics_. Self-published Lecture Notes. Stanford University.
- Stephanie Schmitt-Grohé, Martín Uribe, and Michael Woodford (2022). _International Macroeconomics: A Modern Approach_. Princeton University Press.

<div class="course">
  <h2>Schedule</h2>
  <table class="table table-sm table-responsive">
    <thead>
      <tr><th>Week</th><th>Date</th><th>Topic</th><th>Materials</th></tr>
    </thead>
    <tbody>
      {% for entry in page.schedule %}
        <tr>
          <td>{{ entry.week }}</td>
          <td>{{ entry.date }}</td>
          <td>
            <strong>{{ entry.topic }}</strong>
            <div class="schedule-description">{{ entry.description | markdownify }}</div>
          </td>
          <td>
            <ul class="schedule-materials">
              {% for material in entry.materials %}
                <li><a href="{{ material.url | relative_url }}" target="_blank">{{ material.name }}</a></li>
              {% endfor %}
            </ul>
          </td>
        </tr>
      {% endfor %}
    </tbody>
  </table>

  <h2>Problem Sets</h2>
  <table class="table table-sm table-responsive">
    <thead>
      <tr><th>Week</th><th>Topic</th><th>Materials</th></tr>
    </thead>
    <tbody>
      {% for entry in page.problem_sets %}
        <tr>
          <td>{{ entry.week }}</td>
          <td>
            <strong>{{ entry.topic }}</strong>
            <div class="schedule-description">{{ entry.description | markdownify }}</div>
          </td>
          <td>
            <ul class="schedule-materials">
              {% for material in entry.materials %}
                <li><a href="{{ material.url | relative_url }}" target="_blank">{{ material.name }}</a></li>
              {% endfor %}
            </ul>
          </td>
        </tr>
      {% endfor %}
    </tbody>
  </table>
</div>


## Interactive Materials

- Practice curve shifts, compare equilibria after shocks, and explore alternative preferences and production functions in the [One-Period General Equilibrium Lab]({{ '/tools/one-period-general-equilibrium/' | relative_url }}).
