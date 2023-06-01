import { useState } from "react";
import PropTypes from "prop-types";

export default function App() {
  const [stage, setStage] = useState(0);
  return (
    <>
      <Header />
      {stage === 0 && <DatasetUploader setStage={setStage} />}
      {stage === 1 && <ArchSelector setStage={setStage} />}
    </>
  );
}

function Header() {
  return (
    <header>
      <h1>AWS - Abhinav Web Services</h1>
      <p>Upload a dataset, select a model, and train it on an RTX 3090!</p>
    </header>
  );
}

DatasetUploader.propTypes = {
  setStage: PropTypes.func.isRequired,
};

function DatasetUploader({ setStage }) {
  const [dataset, setDataset] = useState(null);

  function handleSubmit(event) {
    event.preventDefault();
    setStage(1);
    const formData = new FormData();
    formData.append("dataset", dataset);
    fetch("http://localhost:3000/dataset/upload", {
      method: "POST",
      body: formData,
      type: "multipart/form-data",
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          setStage(0);
          throw new Error("server in use, try again later");
        }
      })
      .then((res) => {
        console.log(res);
      })
      .catch((err) => {
        if (err.message === "server in use, try again later") {
          alert(err.message);
        } else {
          alert("server error, try again later");
        }
      });
  }

  return (
    <section>
      <h2>Upload Dataset</h2>
      <p>Upload a dataset to train a model on.</p>
      <fieldset>
        <form onSubmit={handleSubmit}>
          <input
            type="file"
            name="dataset"
            accept=".csv,.zip"
            onChange={(event) => {
              setDataset(event.target.files[0]);
            }}
          />
          <input type="submit" value="Upload" />
        </form>
      </fieldset>
    </section>
  );
}

ArchSelector.propTypes = {
  setStage: PropTypes.func.isRequired,
};

function ArchSelector({ setStage }) {
  const [selectedArch, setSelectedArch] = useState(null);

  const options = [
    {
      value: "alexnet",
      label: "AlexNet",
    },
    {
      value: "resnet",
      label: "ResNet",
    },
    {
      value: "vgg",
      label: "VGG",
    },
  ];

  function handleChange(event) {
    setSelectedArch(event.target.value);
  }

  function handleSubmit(event) {
    event.preventDefault();
    setStage(2);
    fetch("http://localhost:3000/select-arch", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        arch: selectedArch,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        console.log(res);
      });
  }

  return (
    <section>
      <h2>Select Architecture</h2>
      <p>Select an architecture to train on.</p>
      <fieldset>
        <form onSubmit={handleSubmit}>
          <ul>
            {options.map((option) => (
              <li key={option.value}>
                <input
                  type="radio"
                  name="arch"
                  value={option.value}
                  onChange={handleChange}
                />
                {option.label}
              </li>
            ))}
          </ul>
          <input type="submit" value="Select" />
        </form>

        <button
          onClick={async () => {
            setStage(0);
            fetch("http://localhost:3000/dataset/delete", {
              method: "DELETE",
            })
              .then((res) => res.json())
              .then((res) => console.log(res));
          }}
        >
          Back
        </button>
      </fieldset>
    </section>
  );
}
