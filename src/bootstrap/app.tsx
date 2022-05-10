import React from "react"
import { Helmet } from "react-helmet"
import Claim from "../iframes/claim"
import "antd/dist/antd.css"
import "./styles.css"

const App = () => (
  <>
    <Helmet>
      <title>Kleros - Claim Manager Injected Display</title>
    </Helmet>
    <Claim />
  </>
)

export default App
