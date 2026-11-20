# Boltz League Match Centre

Open the [Season 26 match centre](https://boltzleague.github.io/#home) and select **Ref Access** to sign in on the current page. The signed-in toolbar provides **Teams & squads**, **Fixtures**, **Live matches** and **Database**. Select **Edit fixture** or **Edit match** on a match card to open that fixture directly.

For goals and own goals, choose the registered player’s club in **Ref logging**. The player and assist lists show that club’s registered squad. **Add missing player** or **Add missing assister** selects the new name in the event and registers it to the squad on publication. An own goal credits the opposing club.

The spectator view loads a bundled programme, then refreshes squads, fixtures and published match events from the hosted league service while the page is visible. The service checks referee permissions before accepting updates. GitHub Pages uses a tab-local session that survives a reload and is validated by the service. Passwords belong in the hosted service configuration.

The league’s GitHub organization owns the public website. GitHub Pages serves the website from the repository root on `main`. The hosted league service provides live data and referee access. Legacy Match Centre bookmarks redirect to GitHub Pages.
